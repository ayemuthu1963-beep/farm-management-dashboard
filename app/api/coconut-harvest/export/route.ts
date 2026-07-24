import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured" }, { status: 503 })
  }

  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const response = await fetch(`${getApiBaseUrl()}/api/export/xlsx?${params.toString()}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return NextResponse.json({ error: `Harvest API returned ${response.status}` }, { status: 503 })
  }

  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=harvest-${startDate}-to-${endDate}.xlsx`,
    },
  })
}
