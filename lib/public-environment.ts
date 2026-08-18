export type PublicMfmsEnvironment = "production" | "preview" | "test" | "local" | "vercel" | "unknown"

export const EXPECTED_PUBLIC_DATABASES: Readonly<Partial<Record<PublicMfmsEnvironment, string>>> = {
  production: "mfms_server_prod",
  preview: "mfms_server_uat",
  test: "mfms_server_test",
  local: "mfms_local_test",
}

const ENVIRONMENT_LABELS: Readonly<Record<PublicMfmsEnvironment, string>> = {
  production: "PRODUCTION",
  preview: "PREVIEW / UAT",
  test: "TEST / BUYER DEMONSTRATION",
  local: "LOCAL DEVELOPMENT",
  vercel: "VERCEL VALIDATION",
  unknown: "ENVIRONMENT UNKNOWN",
}

const DATABASE_ENVIRONMENT_NAMES: Readonly<Record<PublicMfmsEnvironment, string>> = {
  production: "Production",
  preview: "Preview",
  test: "Test",
  local: "Local",
  vercel: "Vercel",
  unknown: "Unknown",
}

export function normalizePublicEnvironment(value?: string): PublicMfmsEnvironment {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (normalized === "production" || normalized === "prod") return "production"
  if (normalized === "preview" || normalized === "uat") return "preview"
  if (normalized === "test") return "test"
  if (normalized === "local" || normalized === "development") return "local"
  if (normalized.includes("vercel")) return "vercel"
  return "unknown"
}

export function publicEnvironmentIdentity(environmentValue?: string, databaseValue?: string) {
  const environment = normalizePublicEnvironment(environmentValue)
  const configuredDatabase = databaseValue?.trim() || null
  const expectedDatabase = EXPECTED_PUBLIC_DATABASES[environment] ?? null
  const databaseMismatch = Boolean(
    expectedDatabase && configuredDatabase !== expectedDatabase,
  )

  return {
    environment,
    label: ENVIRONMENT_LABELS[environment],
    configuredDatabase,
    expectedDatabase,
    database: configuredDatabase ?? expectedDatabase,
    databaseMismatch,
  }
}

export function irrigationEnvironmentCopy(environmentValue?: string, databaseValue?: string) {
  const identity = publicEnvironmentIdentity(environmentValue, databaseValue)
  const environmentName = identity.databaseMismatch
    ? DATABASE_ENVIRONMENT_NAMES.unknown
    : DATABASE_ENVIRONMENT_NAMES[identity.environment]

  return {
    databaseName: `${environmentName} database`,
    liveDataBadge: `LIVE ${environmentName.toUpperCase()} DATABASE DATA`,
  }
}
