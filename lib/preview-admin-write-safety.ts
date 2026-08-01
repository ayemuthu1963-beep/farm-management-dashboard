type Environment = Record<string, string | undefined>

const APPROVED_ENVIRONMENTS = new Set(["preview", "uat"])
const APPROVED_DATABASE = "mfms_server_uat"
const APPROVED_BACKEND_HOST = "harvest-api-pilot"
const APPROVED_BACKEND_PORT = "8000"
const PRODUCTION_DATABASE_NAMES = new Set(["harvest", "production", "mfms_production"])

function normalise(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function parseHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((host) => normalise(host))
    .filter(Boolean)
}

export function getPreviewAdminTargetSafetyErrors(
  env: Environment,
  apiBaseUrl: string,
): string[] {
  const errors: string[] = []
  const environment = normalise(env.MFMS_ENV)
  const targetDatabase = (env.MFMS_TARGET_DATABASE ?? "").trim()
  const guardedDatabase = (env.MFMS_LOCAL_WRITE_DATABASE ?? "").trim()
  const configuredHost = normalise(env.MFMS_LOCAL_WRITE_BACKEND_HOST)
  const configuredPort = (env.MFMS_LOCAL_WRITE_BACKEND_PORT ?? "").trim()
  const allowedPort = (env.MFMS_ALLOWED_BACKEND_PORT ?? "").trim()
  const allowedHosts = parseHosts(env.MFMS_ALLOWED_BACKEND_HOSTS)

  if (normalise(env.MFMS_ENABLE_LOCAL_WRITE_GUARD) !== "true") {
    errors.push("MFMS_ENABLE_LOCAL_WRITE_GUARD must be true for Preview admin writes.")
  }
  if (!APPROVED_ENVIRONMENTS.has(environment)) {
    errors.push("MFMS_ENV must be preview or uat for Preview admin writes.")
  }
  if (targetDatabase !== APPROVED_DATABASE) {
    errors.push("MFMS_TARGET_DATABASE must be mfms_server_uat for Preview admin writes.")
  }
  if (guardedDatabase !== APPROVED_DATABASE || guardedDatabase !== targetDatabase) {
    errors.push("MFMS_LOCAL_WRITE_DATABASE must match the approved Preview database.")
  }
  if (targetDatabase && PRODUCTION_DATABASE_NAMES.has(targetDatabase.toLowerCase())) {
    errors.push("Production database names are rejected for Preview admin writes.")
  }
  if (configuredHost !== APPROVED_BACKEND_HOST) {
    errors.push("MFMS_LOCAL_WRITE_BACKEND_HOST does not match the approved Preview API host.")
  }
  if (configuredPort !== APPROVED_BACKEND_PORT || allowedPort !== APPROVED_BACKEND_PORT) {
    errors.push("Configured Preview API ports must both be 8000.")
  }
  if (allowedHosts.length !== 1 || allowedHosts[0] !== APPROVED_BACKEND_HOST) {
    errors.push("MFMS_ALLOWED_BACKEND_HOSTS must contain only harvest-api-pilot.")
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(apiBaseUrl)
  } catch {
    errors.push("Preview API base URL is invalid.")
    return errors
  }

  if (parsedUrl.username || parsedUrl.password) {
    errors.push("Preview API base URL must not contain credentials.")
  }

  const actualHost = normalise(parsedUrl.hostname)
  const actualPort = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80")
  if (actualHost !== APPROVED_BACKEND_HOST) {
    errors.push("Preview API host does not match harvest-api-pilot.")
  }
  if (actualPort !== APPROVED_BACKEND_PORT) {
    errors.push("Preview API port does not match 8000.")
  }

  return errors
}

export const getPreviewAdminWriteSafetyErrors = getPreviewAdminTargetSafetyErrors
