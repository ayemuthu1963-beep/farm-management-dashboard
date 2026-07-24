import { NextRequest, NextResponse } from "next/server"
import { fetchHarvestSummaryData } from "@/lib/coconut-harvest-api"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  try {
    const data = await fetchHarvestSummaryData({
      harvestCycle: searchParams.get("harvest_cycle") ?? undefined,
      startDate: searchParams.get("start_date") ?? undefined,
      endDate: searchParams.get("end_date") ?? undefined,
    })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch harvest summary",
      },
      { status: 503 },
    )
  }
}
