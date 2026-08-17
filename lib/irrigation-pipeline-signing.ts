import {
  type WorkerActor,
  type WorkerActorRole,
  WorkerBffError,
} from "@/lib/worker-management-signing"

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const ROLES = new Set<WorkerActorRole>(["admin", "manager", "viewer"])

function normalise(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase()
}

function enabled(value: string | undefined) {
  return TRUE_VALUES.has(normalise(value))
}

function pipelineRole(value: string | undefined | null): WorkerActorRole {
  const role = normalise(value)
  if (role === "tester") return "viewer"
  if (!ROLES.has(role as WorkerActorRole)) {
    throw new WorkerBffError("The authenticated MFMS role is missing or unsupported.", 403)
  }
  return role as WorkerActorRole
}

export function resolvePipelineActor(
  requestHeaders: Headers,
  environment: NodeJS.ProcessEnv,
): WorkerActor {
  const configuredEnvironment = normalise(
    environment.MFMS_ENV ?? environment.NEXT_PUBLIC_MFMS_ENV,
  )
  if (!configuredEnvironment) {
    throw new WorkerBffError("MFMS_ENV is not configured.", 503)
  }

  if (configuredEnvironment === "local") {
    if (!enabled(environment.MFMS_WORKER_LOCAL_ACTOR_ENABLED)) {
      throw new WorkerBffError("The local MFMS actor is disabled.", 401)
    }
    const username = (environment.MFMS_WORKER_LOCAL_ACTOR_USERNAME ?? "").trim()
    if (!username) throw new WorkerBffError("The local MFMS username is missing.", 503)
    return {
      username,
      role: pipelineRole(environment.MFMS_WORKER_LOCAL_ACTOR_ROLE),
      environment: "local",
    }
  }

  if (!enabled(environment.MFMS_TRUST_PROXY_ACTOR_HEADERS)) {
    throw new WorkerBffError("Trusted MFMS proxy identity headers are not enabled.", 503)
  }
  const username = (requestHeaders.get("x-mfms-user") ?? "").trim()
  if (!username || username.length > 200) {
    throw new WorkerBffError("A valid authenticated MFMS user is required.", 401)
  }
  const assertedEnvironment = normalise(requestHeaders.get("x-mfms-environment"))
  if (assertedEnvironment && assertedEnvironment !== configuredEnvironment) {
    throw new WorkerBffError("The authenticated MFMS environment does not match Preview.", 401)
  }
  return {
    username,
    role: pipelineRole(requestHeaders.get("x-mfms-role")),
    environment: configuredEnvironment,
  }
}
