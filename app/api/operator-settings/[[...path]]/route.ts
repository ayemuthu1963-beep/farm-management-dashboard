import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { resolvePipelineActor } from "@/lib/irrigation-pipeline-signing"
import {
  sha256Hex,
  signActorAssertion,
  signAuthenticatedUserAssertion,
  WorkerBffError,
} from "@/lib/worker-management-signing"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ path?: string[] }> }

function errorResponse(message: string, status: number) {
  return Response.json(
    { detail: message },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  )
}

async function proxy(request: Request, context: RouteContext, method: "GET" | "PUT") {
  const { path = [] } = await context.params
  const suffix = path.join("/")
  const allowed = method === "GET"
    ? suffix === "" || /^irrigation-plan\/(drip-output|motor-run-schedule)$/.test(suffix)
    : /^motors\/M[1-3]$/.test(suffix)
      || /^irrigation-targets\/(P1W|P1E|P2W|P2E|JF|NM)$/.test(suffix)
      || /^irrigation-plan\/(drip-output|motor-run-schedule)$/.test(suffix)

  if (!allowed) return errorResponse("Operator settings path was not found.", 404)

  try {
    const target = `/api/operator-settings${suffix ? `/${suffix}` : ""}`
    const actor = resolvePipelineActor(request.headers, process.env, method)
    const body = method === "PUT" ? await request.arrayBuffer() : new ArrayBuffer(0)
    const bodySha256 = sha256Hex(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const actorSignature = signActorAssertion(process.env.MFMS_ACTOR_ASSERTION_SECRET ?? "", {
      timestamp,
      method,
      target,
      bodySha256,
      username: actor.username,
      role: actor.role,
      environment: actor.environment,
    })
    const authenticatedUserSignature = signAuthenticatedUserAssertion(
      process.env.HARVEST_API_PASSWORD ?? "",
      { timestamp, method, target, username: actor.username },
    )
    const authHeader = getBasicAuthHeader()
    if (!authHeader) return errorResponse("Harvest API credentials are not configured.", 500)

    const response = await fetch(`${getApiBaseUrl()}${target}`, {
      method,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "X-MFMS-Authenticated-User": actor.username,
        "X-MFMS-Authenticated-User-Timestamp": timestamp,
        "X-MFMS-Authenticated-User-Signature": authenticatedUserSignature,
        "X-MFMS-Authenticated-Role": actor.role,
        "X-MFMS-Authenticated-Environment": actor.environment,
        "X-MFMS-Authenticated-Timestamp": timestamp,
        "X-MFMS-Authenticated-Body-SHA256": bodySha256,
        "X-MFMS-Authenticated-Signature": actorSignature,
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      body: body.byteLength ? body : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    const responseText = await response.text()
    return new Response(responseText, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const status = error instanceof WorkerBffError ? error.status : 502
    const message = error instanceof Error ? error.message : "Operator settings service is unavailable."
    return errorResponse(message, status)
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxy(request, context, "GET")
}

export async function PUT(request: Request, context: RouteContext) {
  return proxy(request, context, "PUT")
}
