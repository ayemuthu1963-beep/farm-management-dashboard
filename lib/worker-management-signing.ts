import { createHash, createHmac } from "node:crypto"

export type WorkerActorRole = "admin" | "manager" | "viewer"

export type WorkerActor = {
  username: string
  role: WorkerActorRole
  environment: string
}

export class WorkerBffError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "WorkerBffError"
    this.status = status
  }
}

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const ACTOR_ROLES = new Set<WorkerActorRole>(["admin", "manager", "viewer"])

function normalise(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase()
}

function enabled(value: string | undefined): boolean {
  return TRUE_VALUES.has(normalise(value))
}

function parseRole(value: string | undefined | null): WorkerActorRole {
  const role = normalise(value) as WorkerActorRole
  if (!ACTOR_ROLES.has(role)) {
    throw new WorkerBffError("The MFMS user role is missing or unsupported.", 403)
  }
  return role
}

export function resolveWorkerActor(
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
      throw new WorkerBffError("The local Worker Management actor is disabled.", 401)
    }
    const username = (environment.MFMS_WORKER_LOCAL_ACTOR_USERNAME ?? "").trim()
    if (!username) {
      throw new WorkerBffError("The local Worker Management username is missing.", 503)
    }
    return {
      username,
      role: parseRole(environment.MFMS_WORKER_LOCAL_ACTOR_ROLE),
      environment: "local",
    }
  }

  if (!enabled(environment.MFMS_TRUST_PROXY_ACTOR_HEADERS)) {
    throw new WorkerBffError("Trusted MFMS proxy identity headers are not enabled.", 503)
  }

  const username = (requestHeaders.get("x-mfms-user") ?? "").trim()
  const actorEnvironment = normalise(requestHeaders.get("x-mfms-environment"))
  if (!username || username.length > 200) {
    throw new WorkerBffError("A valid authenticated MFMS user is required.", 401)
  }
  if (actorEnvironment !== configuredEnvironment) {
    throw new WorkerBffError("The authenticated MFMS environment does not match this application.", 401)
  }

  return {
    username,
    role: parseRole(requestHeaders.get("x-mfms-role")),
    environment: actorEnvironment,
  }
}

export function sha256Hex(body: ArrayBuffer | ArrayBufferView | string): string {
  const input =
    typeof body === "string"
      ? body
      : ArrayBuffer.isView(body)
        ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
        : new Uint8Array(body)
  return createHash("sha256").update(input).digest("hex")
}

export function actorCanonicalString(input: {
  timestamp: string
  method: string
  target: string
  bodySha256: string
  username: string
  role: string
  environment: string
}): string {
  return [
    input.timestamp,
    input.method.toUpperCase(),
    input.target,
    input.bodySha256,
    input.username,
    input.role,
    input.environment,
  ].join("\n")
}

export function signActorAssertion(
  secret: string,
  input: Parameters<typeof actorCanonicalString>[0],
): string {
  if (secret.length < 32) {
    throw new WorkerBffError("MFMS actor assertion signing is not configured.", 503)
  }
  return createHmac("sha256", secret)
    .update(actorCanonicalString(input), "utf8")
    .digest("hex")
}
