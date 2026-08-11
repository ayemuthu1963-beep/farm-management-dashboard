import { createHmac } from "node:crypto"

type Environment = Record<string, string | undefined>

const TRUSTED_HEADER_ENVIRONMENTS = new Set(["preview", "uat", "test", "production", "prod"])
const LOCAL_ENVIRONMENTS = new Set(["local", "development"])
const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

export class MfmsAdminIdentityError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "MfmsAdminIdentityError"
    this.status = status
  }
}

function normalise(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase()
}

function validUsername(value: string | undefined | null): string | null {
  const username = value?.trim()
  if (!username || username.length > 128 || /[\u0000-\u001f\u007f]/.test(username)) return null
  return username
}

function basicUsername(headers: Headers): string | null {
  const match = headers.get("authorization")?.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i)
  if (!match) return null
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    return separator > 0 ? validUsername(decoded.slice(0, separator)) : null
  } catch {
    return null
  }
}

export function resolveMfmsAdminUsername(
  headers: Headers,
  environment: Environment = process.env,
): string {
  const configuredEnvironment = normalise(environment.MFMS_ENV ?? environment.NEXT_PUBLIC_MFMS_ENV)
  if (!configuredEnvironment) {
    throw new MfmsAdminIdentityError("MFMS_ENV is not configured.", 503)
  }

  if (LOCAL_ENVIRONMENTS.has(configuredEnvironment)) {
    const username = basicUsername(headers)
    if (!username) throw new MfmsAdminIdentityError("Local MFMS administrator authentication is required.", 401)
    return username
  }

  if (!TRUSTED_HEADER_ENVIRONMENTS.has(configuredEnvironment)) {
    throw new MfmsAdminIdentityError("This MFMS environment is not approved for administrator workflows.", 403)
  }
  if (!TRUE_VALUES.has(normalise(environment.MFMS_TRUST_PROXY_ACTOR_HEADERS))) {
    throw new MfmsAdminIdentityError("Trusted MFMS gateway identity headers are not enabled.", 503)
  }

  const username = validUsername(headers.get("x-mfms-user"))
  if (!username) throw new MfmsAdminIdentityError("MFMS administrator authentication is required.", 401)
  return username
}

export function getAuthenticatedUserAssertionHeaders(input: {
  requestHeaders: Headers
  method: string
  target: URL
  environment?: Environment
  timestamp?: string
}): Record<string, string> {
  const environment = input.environment ?? process.env
  const username = resolveMfmsAdminUsername(input.requestHeaders, environment)
  const secret = environment.HARVEST_API_PASSWORD ?? ""
  if (!secret) {
    throw new MfmsAdminIdentityError("MFMS authenticated-user signing is not configured.", 503)
  }
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000).toString()
  const target = `${input.target.pathname}${input.target.search}`
  const canonical = [timestamp, input.method.toUpperCase(), target, username].join("\n")
  const signature = createHmac("sha256", secret).update(canonical, "utf8").digest("hex")
  return {
    "X-MFMS-Authenticated-User": username,
    "X-MFMS-Authenticated-User-Timestamp": timestamp,
    "X-MFMS-Authenticated-User-Signature": signature,
  }
}
