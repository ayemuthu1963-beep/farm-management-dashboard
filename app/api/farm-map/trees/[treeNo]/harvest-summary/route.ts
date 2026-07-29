import { NextResponse } from "next/server"

import {
  fetchFarmMapTreeHarvestSummary,
  HarvestApiError,
} from "@/lib/coconut-harvest-api"

interface RouteContext {
  params: Promise<{
    treeNo: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { treeNo } = await context.params
    const cleanTreeNo = treeNo.trim()
    if (!cleanTreeNo) {
      return NextResponse.json({ error: "Tree Number is required" }, { status: 400 })
    }

    return NextResponse.json(await fetchFarmMapTreeHarvestSummary(cleanTreeNo))
  } catch (error) {
    if (error instanceof HarvestApiError && error.status === 404) {
      return NextResponse.json({ error: "No Harvest data" }, { status: 404 })
    }

    console.error("[farm-map-tree-summary]", error)
    return NextResponse.json({ error: "Unable to load Harvest data" }, { status: 503 })
  }
}
