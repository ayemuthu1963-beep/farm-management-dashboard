import { NextResponse } from "next/server"

import { fetchFarmMapTrees } from "@/lib/farm-map/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await fetchFarmMapTrees(), {
      headers: {
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error(
      "[farm-map-trees]",
      error instanceof Error ? error.message : "Unknown Farm Map API error",
    )
    return NextResponse.json(
      { error: "Farm Map operational data is temporarily unavailable" },
      { status: 503 },
    )
  }
}
