export function isBeetleTrapManualSyncAvailable(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const publicEnvironment = (environment.NEXT_PUBLIC_MFMS_ENV ?? "").trim().toLowerCase()
  const serverEnvironment = (environment.MFMS_ENV ?? "").trim().toLowerCase()
  if (publicEnvironment === "production" || serverEnvironment === "production") return false
  return (
    publicEnvironment === "preview" ||
    publicEnvironment === "uat" ||
    serverEnvironment === "preview" ||
    serverEnvironment === "uat"
  )
}
