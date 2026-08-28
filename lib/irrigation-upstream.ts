export const MOTOR_RUNTIME_PAGE_SIZE = 100

export class MotorRuntimeUpstreamError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(responseLabel: string, status: number, payload: unknown) {
    super(`${responseLabel} returned ${status}`)
    this.name = "MotorRuntimeUpstreamError"
    this.status = status
    this.payload = payload
  }
}

interface FetchAllMotorRuntimeEntriesOptions {
  baseUrl: string
  startDate: string
  endDate: string
  headers?: HeadersInit
  responseLabel: string
  fetchImpl?: typeof fetch
}

function pageSignature(rows: unknown[]): string {
  return JSON.stringify([rows.length, rows[0] ?? null, rows.at(-1) ?? null])
}

export async function fetchAllMotorRuntimeEntries<T>({
  baseUrl,
  startDate,
  endDate,
  headers,
  responseLabel,
  fetchImpl = fetch,
}: FetchAllMotorRuntimeEntriesOptions): Promise<T[]> {
  const allRows: T[] = []
  const seenPages = new Set<string>()
  let offset = 0

  while (true) {
    const params = new URLSearchParams({
      limit: MOTOR_RUNTIME_PAGE_SIZE.toString(),
      offset: offset.toString(),
      start_date: startDate,
      end_date: endDate,
    })
    const requestHeaders = new Headers(headers)
    requestHeaders.set("Accept", "application/json")
    const response = await fetchImpl(
      `${baseUrl.replace(/\/$/, "")}/api/motor-runtime/entries?${params.toString()}`,
      { headers: requestHeaders, cache: "no-store" },
    )
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as unknown
      throw new MotorRuntimeUpstreamError(responseLabel, response.status, payload)
    }

    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error(`${responseLabel} returned an invalid response`)
    if (rows.length === 0) break

    const signature = pageSignature(rows)
    if (seenPages.has(signature)) {
      throw new Error(`${responseLabel} pagination did not advance`)
    }
    seenPages.add(signature)
    allRows.push(...rows as T[])

    if (rows.length < MOTOR_RUNTIME_PAGE_SIZE) break
    offset += rows.length
  }

  return allRows
}
