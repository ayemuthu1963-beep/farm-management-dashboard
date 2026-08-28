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
  if (!configuredEnvironment) {
    throw new WorkerBffError("MFMS_ENV is not configured.", 503)
  }

  if (configuredEnvironment === "local") {
    if (!enabled(environment.MFMS_WORKER_LOCAL_ACTOR_ENABLED)) {
      throw new WorkerBffError("The local MFMS actor is disabled.", 401)
    }
    const username = (environment.MFMS_WORKER_LOCAL_ACTOR_USERNAME ?? "").trim()
    if (!username) throw new WorkerBffError("The local MFMS username is missing.", 503)
    try {
      return {
        username,
        role: pipelineAssertionRole(environment.MFMS_WORKER_LOCAL_ACTOR_ROLE),
        environment: "local",
      }
    } catch (error) {
      workerIdentityError(error)
    }
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
