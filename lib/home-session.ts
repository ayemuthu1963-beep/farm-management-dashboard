import { Buffer } from "node:buffer"
import { TextDecoder } from "node:util"

type GatewayHeaders = { get(name: string): string | null }
type Environment = Record<string, string | undefined>

export type HomeSession = { displayName: string | null; csrf: string | null }

function validName(value: string | null): string | null {
  if (!value || value.length > 128 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) return null
  const name = value.trim()
  if (!name || Buffer.from(name, "utf8").toString("utf8") !== name) return null
  return name
}

function decodeDisplayName(value: string | null): string | null {
  if (!value || value.length > 684 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null
  try {
    const bytes = Buffer.from(value, "base64")
    if (bytes.toString("base64") !== value) return null
    return validName(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes))
  } catch {
    return null
  }
}

// Call only from the server page, behind the gateway that overwrites these headers.
export function resolveHomeSession(headers: GatewayHeaders, environment: Environment = process.env): HomeSession {
  const empty: HomeSession = { displayName: null, csrf: null }
  const site = (environment.MFMS_ENV ?? environment.NEXT_PUBLIC_MFMS_ENV ?? "").trim().toLowerCase()
  const trusted = ["1", "true", "yes", "on"].includes((environment.MFMS_TRUST_PROXY_ACTOR_HEADERS ?? "").trim().toLowerCase())
  if (!trusted || !["production", "prod"].includes(site) || headers.get("x-mfms-environment") !== "production") return empty
  const username = validName(headers.get("x-mfms-user"))
  if (!username) return empty
  const csrf = headers.get("x-mfms-session-csrf")
  return {
    displayName: decodeDisplayName(headers.get("x-mfms-display-name-b64")) ?? username,
    csrf: csrf && /^[A-Za-z0-9_-]{43}$/.test(csrf) ? csrf : null,
  }
}
