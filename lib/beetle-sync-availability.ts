export function isBeetleTrapManualSyncAvailable(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const publicEnvironment = (environment.NEXT_PUBLIC_MFMS_ENV ?? "").trim().toLowerCase()
  const serverEnvironment = (environment.MFMS_ENV ?? "").trim().toLowerCase()
  const approved = new Set(["production", "prod"])
  return approved.has(publicEnvironment) || approved.has(serverEnvironment)
}
