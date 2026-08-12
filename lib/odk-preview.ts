export const ODK_CENTRAL_BASE_URL = (
  process.env.NEXT_PUBLIC_ODK_CENTRAL_URL ?? "https://odk.muthufarms.com"
).replace(/\/$/, "")

const mfmsEnvironment = (process.env.NEXT_PUBLIC_MFMS_ENV ?? "preview").trim().toLowerCase()
const defaultProjectId = ["production", "production-candidate"].includes(mfmsEnvironment)
  ? "22"
  : mfmsEnvironment === "test"
    ? "24"
    : "23"

export const PREVIEW_FIELD_COLLECTOR_PROJECT_ID =
  process.env.NEXT_PUBLIC_ODK_PROJECT_ID?.trim() || defaultProjectId

export const FIELD_COLLECTOR_PROJECT_NAME = ["production", "production-candidate"].includes(
  mfmsEnvironment,
)
  ? "Muthu Field Collector"
  : mfmsEnvironment === "test"
    ? "MFMS Test Field Collector"
    : "MFMS Preview Field Collector"

const formVersionsByProjectId: Record<
  string,
  { wellWater: string; beetleTrap: string; harvest: string }
> = {
  "22": { wellWater: "20260808.1", beetleTrap: "20260808.1", harvest: "20260808.1" },
  "23": { wellWater: "20260723.2", beetleTrap: "20260723.1", harvest: "20260827.2" },
  "24": { wellWater: "20260808.1", beetleTrap: "20260808.1", harvest: "20260808.1" },
}

const projectFormVersions = formVersionsByProjectId[PREVIEW_FIELD_COLLECTOR_PROJECT_ID] ?? {
  wellWater: "unknown",
  beetleTrap: "unknown",
  harvest: "unknown",
}

export const previewOdkForms = {
  wellWater: {
    label: "MFMS Well Water",
    projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_well_water_test_v1",
    publishedVersion:
      process.env.NEXT_PUBLIC_ODK_WELL_WATER_FORM_VERSION?.trim() || projectFormVersions.wellWater,
  },
  beetleTrap: {
    label: "MFMS Beetle Trap Counts",
    projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_beetle_test_v1",
    publishedVersion:
      process.env.NEXT_PUBLIC_ODK_BEETLE_TRAP_FORM_VERSION?.trim() || projectFormVersions.beetleTrap,
  },
  harvest: {
    label: "MFMS Harvest",
    projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_harvest_test_v1",
    publishedVersion:
      process.env.NEXT_PUBLIC_ODK_HARVEST_FORM_VERSION?.trim() || projectFormVersions.harvest,
  },
} as const

export type PreviewOdkFormKey = keyof typeof previewOdkForms

export function odkProjectUrl(projectId: string): string {
  return `${ODK_CENTRAL_BASE_URL}/projects/${encodeURIComponent(projectId)}`
}

export function odkFormSubmissionsUrl(projectId: string, formId: string): string {
  return `${odkProjectUrl(projectId)}/forms/${encodeURIComponent(formId)}/submissions`
}
