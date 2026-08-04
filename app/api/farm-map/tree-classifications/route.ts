import { NextResponse } from "next/server"

import { fetchFarmMapTreeClassifications } from "@/lib/coconut-harvest-api"

export async function GET() {
  try {
    return NextResponse.json({ rows: await fetchFarmMapTreeClassifications() })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch tree classifications",
      },
      { status: 503 },
    )
  }
}
