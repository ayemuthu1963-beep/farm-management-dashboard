export type PipelineAssertionRole = "admin" | "manager" | "viewer"
export type PipelineMethod = string

const ASSERTION_ROLES = new Set<PipelineAssertionRole>(["admin", "manager", "viewer"])

export class PipelineIdentityError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "PipelineIdentityError"
    this.status = status
  }
}

function normalise(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase()
}

export function pipelineAssertionRole(value: string | undefined | null): PipelineAssertionRole {
  const role = normalise(value)
  if (role === "owner") return "admin"
  if (role === "tester") return "viewer"
  if (!ASSERTION_ROLES.has(role as PipelineAssertionRole)) {
    throw new PipelineIdentityError("The authenticated MFMS role is missing or unsupported.", 403)
  }
  return role as PipelineAssertionRole
}

export function resolveTrustedPipelineIdentity(
  requestHeaders: Headers,
  configuredEnvironment: string,
  method: PipelineMethod,
  trustedProxyHeaders = true,
) {
  if (!trustedProxyHeaders) {
    throw new PipelineIdentityError("Trusted MFMS proxy identity headers are not enabled.", 503)
  }
  const username = (requestHeaders.get("x-mfms-user") ?? "").trim()
  if (!username || username.length > 200 || /[\u0000-\u001f\u007f]/.test(username)) {
    throw new PipelineIdentityError("A valid authenticated MFMS user is required.", 401)
  }
  const assertedEnvironment = normalise(requestHeaders.get("x-mfms-environment"))
  if (!assertedEnvironment || assertedEnvironment !== configuredEnvironment) {
    throw new PipelineIdentityError("The authenticated MFMS environment does not match Preview.", 401)
  }
  const role = pipelineAssertionRole(requestHeaders.get("x-mfms-role"))
  const permission = normalise(requestHeaders.get("x-mfms-permission"))
  const requiredPermission = method === "GET" ? "read" : "write"
  if (permission !== requiredPermission) {
    throw new PipelineIdentityError("The authenticated MFMS permission does not allow this request.", 403)
  }
  if (permission === "write" && role === "viewer") {
    throw new PipelineIdentityError("Viewer access is read-only.", 403)
  }
  return { username, role, environment: configuredEnvironment }
}
