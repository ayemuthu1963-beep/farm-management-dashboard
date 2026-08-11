import { publicEnvironmentIdentity } from "@/lib/public-environment"

const styles = {
  production: "border-emerald-300 bg-emerald-100 text-emerald-950",
  preview: "border-orange-300 bg-orange-100 text-orange-950",
  test: "border-amber-300 bg-amber-100 text-amber-950",
  local: "border-sky-300 bg-sky-100 text-sky-950",
  vercel: "border-violet-300 bg-violet-100 text-violet-950",
  unknown: "border-red-300 bg-red-100 text-red-950",
  mismatch: "border-red-500 bg-red-100 text-red-950",
} as const

export function EnvironmentBanner() {
  const vercelEnvironment = process.env.VERCEL === "1"
    ? `vercel-${process.env.VERCEL_ENV ?? "validation"}`
    : undefined
  const identity = publicEnvironmentIdentity(
    vercelEnvironment
      ?? process.env.NEXT_PUBLIC_MFMS_ENV
      ?? process.env.MFMS_BUILD_ENVIRONMENT,
    vercelEnvironment
      ? undefined
      : process.env.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL,
  )

  const text = identity.databaseMismatch
    ? `CONFIGURATION MISMATCH - ${identity.label} expects ${identity.expectedDatabase}; configured ${identity.configuredDatabase ?? "not set"}`
    : identity.environment === "vercel"
      ? "VERCEL VALIDATION - DISPOSABLE BUILD - NO LIVE MFMS DATABASE"
      : `${identity.label} - Database: ${identity.database ?? "not configured"}${identity.environment === "production" ? "" : " - TEST DATA / TEST ACTIONS ONLY"}`

  return (
    <div
      role="status"
      data-mfms-environment={identity.environment}
      data-mfms-database={identity.database ?? "unknown"}
      className={`sticky top-0 z-[100] border-b px-4 py-2 text-center text-sm font-black uppercase tracking-wide shadow-sm ${identity.databaseMismatch ? styles.mismatch : styles[identity.environment]}`}
    >
      {text}
    </div>
  )
}
