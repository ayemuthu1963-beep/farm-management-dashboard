import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import {
  resolveWorkerActor,
  sha256Hex,
  signActorAssertion,
  WorkerBffError,
} from "@/lib/worker-management-signing"

type WorkerRouteContext = {
  params: Promise<{ path?: string[] }>
}

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/
const REQUEST_METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"])

function resolveBackendTarget(path: string[] | undefined, search: string): string {
  const parts = path ?? []
  if (parts.some((part) => !SAFE_PATH_SEGMENT.test(part))) {
    throw new WorkerBffError("The Worker Management API path is invalid.", 400)
  }
  const suffix = parts.length ? `/${parts.join("/")}` : ""
  return `/api/worker-management${suffix}${search}`
}

async function proxyWorkerManagement(
  request: Request,
  context: WorkerRouteContext,
): Promise<Response> {
  try {
    const { path } = await context.params
    const requestUrl = new URL(request.url)
    const target = resolveBackendTarget(path, requestUrl.search)
    const actor = resolveWorkerActor(request.headers, process.env)
    const body = REQUEST_METHODS_WITH_BODY.has(request.method)
      ? await request.arrayBuffer()
      : new ArrayBuffer(0)
    const bodySha256 = sha256Hex(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const secret = process.env.MFMS_ACTOR_ASSERTION_SECRET ?? ""
    const signature = signActorAssertion(secret, {
      timestamp,
      method: request.method,
      target,
      bodySha256,
      username: actor.username,
      role: actor.role,
      environment: actor.environment,
    })
    const headers = new Headers({
      Accept: request.headers.get("accept") ?? "application/json",
      "X-MFMS-Authenticated-User": actor.username,
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
    const responseContentType = backendResponse.headers.get("content-type")
    if (responseContentType) responseHeaders.set("Content-Type", responseContentType)

    return new Response(await backendResponse.arrayBuffer(), {
      status: backendResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    const status = error instanceof WorkerBffError ? error.status : 503
    const message =
      error instanceof Error ? error.message : "Unable to reach the Worker Management API."
    return Response.json(
      { detail: message },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  }
}

export const dynamic = "force-dynamic"

export function GET(request: Request, context: WorkerRouteContext) {
  return proxyWorkerManagement(request, context)
}

export function POST(request: Request, context: WorkerRouteContext) {
  return proxyWorkerManagement(request, context)
}

export function PUT(request: Request, context: WorkerRouteContext) {
  return proxyWorkerManagement(request, context)
}

export function PATCH(request: Request, context: WorkerRouteContext) {
  return proxyWorkerManagement(request, context)
}
