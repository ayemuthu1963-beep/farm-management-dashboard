import { ShieldCheck } from "lucide-react"
import { normalizePublicEnvironment, publicEnvironmentIdentity } from "@/lib/public-environment"

export function getPreviewEnvironmentLabel() {
  return publicEnvironmentIdentity(
    process.env.MFMS_ENV ?? process.env.NEXT_PUBLIC_MFMS_ENV,
    process.env.MFMS_TARGET_DATABASE ?? process.env.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL,
  ).label
}

export function getPreviewDatabaseLabel() {
  return (
    process.env.MFMS_TARGET_DATABASE
    ?? process.env.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL
    ?? ""
  ).trim() || "DATABASE NOT CONFIGURED"
}

export function getAdminUsageLabel() {
  const environment = normalizePublicEnvironment(
    process.env.MFMS_ENV ?? process.env.NEXT_PUBLIC_MFMS_ENV,
  )
  if (environment === "production") return "LIVE OPERATIONAL DATA — CONFIRM TARGET BEFORE SAVING"
  if (environment === "preview" || environment === "test" || environment === "local") {
    return "TEST DATA / TEST ACTIONS ONLY"
  }
  return "CONFIGURATION NOT VERIFIED — WRITES MUST REMAIN DISABLED"
}

export function PreviewAdminNotice() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-chart-2/25 bg-chart-2/10 px-4 py-3 text-sm font-bold text-chart-2">
      <span className="inline-flex items-center gap-2">
        <ShieldCheck className="size-5" />
        {getPreviewEnvironmentLabel()} — {getAdminUsageLabel()}
      </span>
      <span>Database: {getPreviewDatabaseLabel()}</span>
    </div>
  )
}
