import { projectPublicMotorNoRunRecords, type PublicMotorNoRunRecord } from "./motor-data"

interface FetchMotorNoRunOptions {
  baseUrl: string
  startDate: string
  endDate: string
  headers: HeadersInit
}

export async function fetchPublicMotorNoRunRecords({
  baseUrl,
  startDate,
  endDate,
  headers,
}: FetchMotorNoRunOptions): Promise<PublicMotorNoRunRecord[]> {
  const query = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const response = await fetch(`${baseUrl}/api/motor-runtime/management/no-run-records?${query}`, {
    headers,
    cache: "no-store",
  })
  if (response.status === 404) return []
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string; detail?: string }
    throw new Error(payload.error ?? payload.detail ?? `Motor Not Run API returned ${response.status}`)
  }
  const payload = await response.json() as unknown
  return projectPublicMotorNoRunRecords(Array.isArray(payload) ? payload : [])
}
