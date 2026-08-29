import { NextResponse } from "next/server"
import { fetchDetailedQueryData, HarvestApiError, type DetailedQueryFilters } from "@/lib/coconut-harvest-api"

function readFilters(request: Request): DetailedQueryFilters {
  const { searchParams } = new URL(request.url)

  return {
    treeFrom: searchParams.get("treeFrom") ?? undefined,
    treeTo: searchParams.get("treeTo") ?? undefined,
    cycleFrom: searchParams.get("cycleFrom") ?? undefined,
    cycleTo: searchParams.get("cycleTo") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    nutsFrom: searchParams.get("nutsFrom") ?? undefined,
    nutsTo: searchParams.get("nutsTo") ?? undefined,
    saleFrom: searchParams.get("saleFrom") ?? undefined,
    saleTo: searchParams.get("saleTo") ?? undefined,
    missedFrom: searchParams.get("missedFrom") ?? undefined,
    missedTo: searchParams.get("missedTo") ?? undefined,
    plot1Classification: searchParams.get("plot1Classification") ?? undefined,
    plot2Classification: searchParams.get("plot2Classification") ?? undefined,
    tiedFrom: searchParams.get("tiedFrom") ?? undefined,
    tiedTo: searchParams.get("tiedTo") ?? undefined,
    tyingRound: searchParams.get("tyingRound") ?? undefined,
  }
}

export async function GET(request: Request) {
  const referenceId = crypto.randomUUID().slice(0, 8)
  try {
    const data = await fetchDetailedQueryData(readFilters(request))
    return NextResponse.json(data, { headers: { "X-Request-ID": referenceId } })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Tree Number")) {
      return NextResponse.json({ error: error.message, referenceId }, { status: 400 })
    }

    const status = error instanceof HarvestApiError ? error.status : 500
    console.error(`[detailed-query:${referenceId}]`, error)
    return NextResponse.json(
      {
        error: "Detailed Query could not be completed",
        referenceId,
      },
      { status, headers: { "X-Request-ID": referenceId } },
    )
  }
}
