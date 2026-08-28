import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { fetchPublicMotorNoRunRecords } from "@/lib/motor-no-run-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const headers: HeadersInit = {}
  const authHeader = getBasicAuthHeader()

  if (authHeader) {
    headers.Authorization = authHeader
  }

  try {
    const startDate = searchParams.get("start_date") ?? ""
    const endDate = searchParams.get("end_date") ?? ""
    const baseUrl = getApiBaseUrl()
    const [response, noRunRecords] = await Promise.all([
      fetch(`${baseUrl}/api/well-water/dashboard?${searchParams.toString()}`, {
        headers,
        cache: "no-store",
      }),
      startDate && endDate
        ? fetchPublicMotorNoRunRecords({ baseUrl, startDate, endDate, headers })
        : Promise.resolve([]),
    ])

    const payload = await response.json()

    if (!response.ok) {
      return NextResponse.json(payload, {
        status: response.status,
        headers: { "Cache-Control": "no-store, max-age=0" },
      })
    }

    return NextResponse.json({
      ...payload,
      motor_no_run_records: noRunRecords,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch Well Water dashboard data",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    )
  }
}
