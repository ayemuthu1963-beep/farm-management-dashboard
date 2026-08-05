import { ShieldCheck } from "lucide-react"

export function getPreviewEnvironmentLabel() {
  const environment = (process.env.MFMS_ENV ?? "").trim().toLowerCase()
  if (environment === "preview" || environment === "uat") return "PREVIEW / UAT"
  if (!environment && process.env.VERCEL_ENV === "preview") return "PREVIEW / UAT"
  return environment ? environment.toUpperCase() : "ENVIRONMENT NOT CONFIGURED"
}

export function getPreviewDatabaseLabel() {
  const configuredDatabase = (process.env.MFMS_TARGET_DATABASE ?? "").trim()
  if (configuredDatabase) return configuredDatabase

  const apiBaseUrl = (process.env.HARVEST_API_BASE_URL ?? "").trim()
  if (process.env.VERCEL_ENV === "preview" && apiBaseUrl) {
    try {
      const hostname = new URL(apiBaseUrl).hostname.toLowerCase()
      if (hostname === "preview.muthufarms.com" || hostname === "harvest-api-pilot") {
        return "mfms_server_uat"
      }
    } catch {
      // Keep the explicit not-configured warning for malformed or unknown targets.
    }
  }

  return "DATABASE NOT CONFIGURED"
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
