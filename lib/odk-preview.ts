export const ODK_CENTRAL_BASE_URL = (
  process.env.NEXT_PUBLIC_ODK_CENTRAL_URL ?? "https://odk.muthufarms.com"
).replace(/\/$/, "")

export const MUTHU_FIELD_COLLECTOR_PROJECT_ID = "22"

export const previewOdkForms = {
  wellWater: {
    label: "MFMS Well Water",
    projectId: MUTHU_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_well_water_test_v1",
    publishedVersion: "20260723.2",
  },
  beetleTrap: {
    label: "MFMS Beetle Trap Counts",
    projectId: MUTHU_FIELD_COLLECTOR_PROJECT_ID,
    formId: "mfms_preview_beetle_test_v1",
    publishedVersion: "20260723.1",
  },
  harvest: {
    label: "MFMS Harvest",
    projectId: "17",
    formId: "mfms_preview_harvest_test_v1",
    publishedVersion: null,
  },
} as const

export type PreviewOdkFormKey = keyof typeof previewOdkForms

export function odkProjectUrl(projectId: string): string {
  return `${ODK_CENTRAL_BASE_URL}/projects/${encodeURIComponent(projectId)}`
}

export function odkFormSubmissionsUrl(projectId: string, formId: string): string {
  return `${odkProjectUrl(projectId)}/forms/${encodeURIComponent(formId)}/submissions`
}
