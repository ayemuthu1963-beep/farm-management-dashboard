import { NextResponse } from "next/server"
import { fetchTreePerformanceData } from "@/lib/coconut-harvest-api"

export async function GET() {
  try {
    const data = await fetchTreePerformanceData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch tree performance data",
      },
      { status: 503 },
    )
  }
}
