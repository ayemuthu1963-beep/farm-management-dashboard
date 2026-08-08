export const ODK_CENTRAL_BASE_URL = (
  process.env.NEXT_PUBLIC_ODK_CENTRAL_URL ?? "https://odk.muthufarms.com"
).replace(/\/$/, "")

const mfmsEnvironment = (process.env.NEXT_PUBLIC_MFMS_ENV ?? "preview").trim().toLowerCase()
const isProduction = ["production", "production-candidate"].includes(mfmsEnvironment)
const isTest = mfmsEnvironment === "test"
const defaultProjectId = isProduction ? "22" : isTest ? "24" : "23"

export const PREVIEW_FIELD_COLLECTOR_PROJECT_ID =
  process.env.NEXT_PUBLIC_ODK_PROJECT_ID?.trim() || defaultProjectId

export const FIELD_COLLECTOR_PROJECT_NAME = isProduction
  ? "Muthu Field Collector"
  : isTest
    ? "MFMS Test Field Collector"
    : "MFMS Preview Field Collector"

const productionOrTestFormVersion = isProduction || isTest ? "20260808.1" : null

export const previewOdkForms = {
  wellWater: {
    label: "MFMS Well Water",
    projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_well_water_test_v1",
    publishedVersion: productionOrTestFormVersion ?? "20260723.2",
  },
  beetleTrap: {
    label: "MFMS Beetle Trap Counts",
    projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_beetle_test_v1",
    publishedVersion: productionOrTestFormVersion ?? "20260723.1",
  },
  harvest: {
    label: "MFMS Harvest",
    projectId: PREVIEW_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_harvest_test_v1",
    publishedVersion: productionOrTestFormVersion ?? "20260827.2",
  },
} as const

export type PreviewOdkFormKey = keyof typeof previewOdkForms

export function odkProjectUrl(projectId: string): string {
  return `${ODK_CENTRAL_BASE_URL}/projects/${encodeURIComponent(projectId)}`
}

export function odkFormSubmissionsUrl(projectId: string, formId: string): string {
  return `${odkProjectUrl(projectId)}/forms/${encodeURIComponent(formId)}/submissions`
}
