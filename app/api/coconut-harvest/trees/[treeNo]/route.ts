import { NextResponse } from "next/server"
import { fetchTreeViewData, HarvestApiError } from "@/lib/coconut-harvest-api"

interface RouteContext {
  params: Promise<{
    treeNo: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { treeNo } = await context.params
    const data = await fetchTreeViewData(treeNo)

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof HarvestApiError && error.status === 404) {
      return NextResponse.json(
        {
          error: "Tree not found",
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch tree harvest history",
      },
      { status: 503 },
    )
  }
}
