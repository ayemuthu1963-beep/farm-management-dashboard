import { NextResponse } from "next/server"
import { fetchTreeNumbers } from "@/lib/coconut-harvest-api"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") ?? ""
    const limit = Number(searchParams.get("limit") ?? "25")
    const treeNumbers = await fetchTreeNumbers(query, Number.isFinite(limit) ? limit : 25)

    return NextResponse.json({ treeNumbers })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch tree numbers",
      },
      { status: 503 },
    )
  }
}
