import {
  type WorkerActor,
  WorkerBffError,
} from "@/lib/worker-management-signing"
import {
  pipelineAssertionRole,
  PipelineIdentityError,
  resolveTrustedPipelineIdentity,
  type PipelineMethod,
} from "@/lib/irrigation-pipeline-identity"

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const TRUSTED_HEADER_ENVIRONMENTS = new Set(["preview", "uat", "test", "production", "prod"])

function normalise(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase()
}

function enabled(value: string | undefined) {
  return TRUE_VALUES.has(normalise(value))
}

function workerIdentityError(error: unknown): never {
  if (error instanceof PipelineIdentityError) {
    throw new WorkerBffError(error.message, error.status)
  }
  throw error
}

export function resolvePipelineActor(
  requestHeaders: Headers,
  environment: NodeJS.ProcessEnv,
  method: PipelineMethod = "GET",
): WorkerActor {
  const configuredEnvironment = normalise(
    environment.MFMS_ENV ?? environment.NEXT_PUBLIC_MFMS_ENV,
  )
  const trustedServerEnvironment = normalise(environment.MFMS_ENV)
  if (!configuredEnvironment) {
    throw new WorkerBffError("MFMS_ENV is not configured.", 503)
  }

  if (trustedServerEnvironment === "local" || trustedServerEnvironment === "development") {
    if (!enabled(environment.MFMS_WORKER_LOCAL_ACTOR_ENABLED)) {
      throw new WorkerBffError("The local MFMS actor is disabled.", 401)
    }
    const username = (environment.MFMS_WORKER_LOCAL_ACTOR_USERNAME ?? "").trim()
    if (!username) throw new WorkerBffError("The local MFMS username is missing.", 503)
    try {
      const role = pipelineAssertionRole(environment.MFMS_WORKER_LOCAL_ACTOR_ROLE)
      if (method !== "GET" && role === "viewer") {
        throw new PipelineIdentityError("Viewer access is read-only.", 403)
      }
      return {
        username,
        role,
        environment: "local",
      }
    } catch (error) {
      workerIdentityError(error)
    }
  }

  if (configuredEnvironment === "local" || configuredEnvironment === "development") {
    throw new WorkerBffError("MFMS_ENV must select the local development identity path.", 503)
  }

  if (!TRUSTED_HEADER_ENVIRONMENTS.has(configuredEnvironment)) {
    throw new WorkerBffError("This MFMS environment is not approved for administrator workflows.", 403)
  }

  try {
    return resolveTrustedPipelineIdentity(
      requestHeaders,
      configuredEnvironment,
      method,
      enabled(environment.MFMS_TRUST_PROXY_ACTOR_HEADERS),
    )
  } catch (error) {
    workerIdentityError(error)
  }
}
