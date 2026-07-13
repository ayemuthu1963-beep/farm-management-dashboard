import { NextRequest, NextResponse } from "next/server"
import { fetchTreePerformanceCategoryData } from "@/lib/coconut-harvest-api"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const plot = searchParams.get("plot")?.trim()
  const category = searchParams.get("category")?.trim()

  if (!plot || !category) {
    return NextResponse.json({ error: "Plot and category are required" }, { status: 400 })
  }

  try {
    const data = await fetchTreePerformanceCategoryData(plot, category)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch tree performance category data",
      },
      { status: 503 },
    )
  }
}
