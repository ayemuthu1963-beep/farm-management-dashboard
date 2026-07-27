import { ShieldCheck } from "lucide-react"

export function getPreviewEnvironmentLabel() {
  const environment = (process.env.MFMS_ENV ?? "").trim().toLowerCase()
  if (environment === "preview" || environment === "uat") return "PREVIEW / UAT"
  return environment ? environment.toUpperCase() : "ENVIRONMENT NOT CONFIGURED"
}

export function getPreviewDatabaseLabel() {
  return (process.env.MFMS_TARGET_DATABASE ?? "").trim() || "DATABASE NOT CONFIGURED"
}

export function PreviewAdminNotice() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-chart-2/25 bg-chart-2/10 px-4 py-3 text-sm font-bold text-chart-2">
      <span className="inline-flex items-center gap-2">
        <ShieldCheck className="size-5" />
        {getPreviewEnvironmentLabel()} — DO NOT USE FOR PRODUCTION DATA
      </span>
      <span>Database: {getPreviewDatabaseLabel()}</span>
    </div>
  )
}
