type Environment = Record<string, string | undefined>

type ApprovedTarget = {
  database: string
  backendHost: string
  backendPort: string
}

const APPROVED_TARGETS: Record<string, ApprovedTarget> = {
  preview: { database: "mfms_server_uat", backendHost: "harvest-api-pilot", backendPort: "8000" },
  uat: { database: "mfms_server_uat", backendHost: "harvest-api-pilot", backendPort: "8000" },
  "production-candidate": {
    database: "mfms_server_prod_candidate",
    backendHost: "harvest-api-prod-candidate",
    backendPort: "8000",
  },
  production: { database: "mfms_server_prod", backendHost: "harvest-api", backendPort: "8000" },
}

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
  const approved = APPROVED_TARGETS[environment]
  const publicEnvironment = normalise(env.NEXT_PUBLIC_MFMS_ENV)
  const publicApproved = publicEnvironment ? APPROVED_TARGETS[publicEnvironment] : undefined
  const targetDatabase = (env.MFMS_TARGET_DATABASE ?? "").trim()
  const guardedDatabase = (env.MFMS_LOCAL_WRITE_DATABASE ?? "").trim()
  const configuredHost = normalise(env.MFMS_LOCAL_WRITE_BACKEND_HOST)
  const configuredPort = (env.MFMS_LOCAL_WRITE_BACKEND_PORT ?? "").trim()
  const allowedPort = (env.MFMS_ALLOWED_BACKEND_PORT ?? "").trim()
  const allowedHosts = parseHosts(env.MFMS_ALLOWED_BACKEND_HOSTS)

  if (normalise(env.MFMS_ENABLE_LOCAL_WRITE_GUARD) !== "true") {
    errors.push("MFMS_ENABLE_LOCAL_WRITE_GUARD must be true for MFMS admin writes.")
  }
  if (!approved) {
    errors.push("MFMS_ENV does not have an approved environment/database target.")
  }
  if (publicEnvironment && !publicApproved) {
    errors.push("NEXT_PUBLIC_MFMS_ENV does not have an approved target.")
  }
  if (
    publicEnvironment &&
    approved &&
    publicApproved &&
    (publicApproved.database !== approved.database || publicApproved.backendHost !== approved.backendHost)
  ) {
    errors.push("Public and server MFMS environments resolve to different targets.")
  }
  if (approved && targetDatabase !== approved.database) {
    errors.push(`MFMS_TARGET_DATABASE must be ${approved.database} for ${environment}.`)
  }
  if (!approved || guardedDatabase !== approved.database || guardedDatabase !== targetDatabase) {
    errors.push("MFMS_LOCAL_WRITE_DATABASE must match the approved target database.")
  }
  if (approved && configuredHost !== approved.backendHost) {
    errors.push("MFMS_LOCAL_WRITE_BACKEND_HOST does not match the approved API host.")
  }
  if (approved && (configuredPort !== approved.backendPort || allowedPort !== approved.backendPort)) {
    errors.push("Configured MFMS API ports do not match the approved target.")
  }
  if (approved && (allowedHosts.length !== 1 || allowedHosts[0] !== approved.backendHost)) {
    errors.push("MFMS_ALLOWED_BACKEND_HOSTS must contain only the approved API host.")
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(apiBaseUrl)
  } catch {
    errors.push("MFMS API base URL is invalid.")
    return errors
  }

  if (parsedUrl.username || parsedUrl.password) {
    errors.push("MFMS API base URL must not contain credentials.")
  }

  const actualHost = normalise(parsedUrl.hostname)
  const actualPort = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80")
  if (approved && actualHost !== approved.backendHost) {
    errors.push("MFMS API host does not match the approved target.")
  }
  if (approved && actualPort !== approved.backendPort) {
    errors.push("MFMS API port does not match the approved target.")
  }

  return errors
}

export const getPreviewAdminWriteSafetyErrors = getPreviewAdminTargetSafetyErrors
export const getAdminTargetSafetyErrors = getPreviewAdminTargetSafetyErrors
