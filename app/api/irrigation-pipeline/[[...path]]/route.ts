import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { resolvePipelineActor } from "@/lib/irrigation-pipeline-signing"
import {
  sha256Hex,
  signActorAssertion,
  signAuthenticatedUserAssertion,
  WorkerBffError,
} from "@/lib/worker-management-signing"

type PipelineRouteContext = { params: Promise<{ path?: string[] }> }

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/
const BODY_METHODS = new Set(["POST", "PATCH"])

function backendTarget(path: string[] | undefined, search: string) {
  const parts = path ?? []
  if (parts.some((part) => !SAFE_PATH_SEGMENT.test(part))) {
    throw new WorkerBffError("The Irrigation Pipeline API path is invalid.", 400)
  }
  return `/api/irrigation-pipeline${parts.length ? `/${parts.join("/")}` : ""}${search}`
}

async function proxyPipeline(request: Request, context: PipelineRouteContext) {
  try {
    const { path } = await context.params
    const requestUrl = new URL(request.url)
    const target = backendTarget(path, requestUrl.search)
    const actor = resolvePipelineActor(request.headers, process.env)
    const body = BODY_METHODS.has(request.method) ? await request.arrayBuffer() : new ArrayBuffer(0)
    const bodySha256 = sha256Hex(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = signActorAssertion(process.env.MFMS_ACTOR_ASSERTION_SECRET ?? "", {
      timestamp,
      method: request.method,
      target,
      bodySha256,
      username: actor.username,
      role: actor.role,
      environment: actor.environment,
    })
    const authenticatedUserSignature = signAuthenticatedUserAssertion(
      process.env.HARVEST_API_PASSWORD ?? "",
      { timestamp, method: request.method, target, username: actor.username },
    )
    const headers = new Headers({
      Accept: request.headers.get("accept") ?? "application/json",
      "X-MFMS-Authenticated-User": actor.username,
      "X-MFMS-Authenticated-User-Timestamp": timestamp,
      "X-MFMS-Authenticated-User-Signature": authenticatedUserSignature,
      "X-MFMS-Authenticated-Role": actor.role,
      "X-MFMS-Authenticated-Environment": actor.environment,
      "X-MFMS-Authenticated-Timestamp": timestamp,
      "X-MFMS-Authenticated-Body-SHA256": bodySha256,
      "X-MFMS-Authenticated-Signature": signature,
    })
    const contentType = request.headers.get("content-type")
    const serviceAuthorization = getBasicAuthHeader()
    if (contentType) headers.set("Content-Type", contentType)
    if (serviceAuthorization) headers.set("Authorization", serviceAuthorization)

    const backendResponse = await fetch(`${getApiBaseUrl()}${target}`, {
      method: request.method,
      headers,
      body: body.byteLength ? body : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    })
    for (const name of ["content-type", "content-disposition"]) {
      const value = backendResponse.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    return new Response(await backendResponse.arrayBuffer(), {
      status: backendResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    const status = error instanceof WorkerBffError ? error.status : 503
    const detail = error instanceof Error ? error.message : "Unable to reach the pipeline API."
    return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } })
  }
}

export const dynamic = "force-dynamic"

export function GET(request: Request, context: PipelineRouteContext) {
  return proxyPipeline(request, context)
}

export function POST(request: Request, context: PipelineRouteContext) {
  return proxyPipeline(request, context)
}

export function PATCH(request: Request, context: PipelineRouteContext) {
  return proxyPipeline(request, context)
}
