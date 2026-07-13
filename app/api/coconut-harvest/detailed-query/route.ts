import { NextResponse } from "next/server"
import { fetchDetailedQueryData, type DetailedQueryFilters } from "@/lib/coconut-harvest-api"

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
  }
}

export async function GET(request: Request) {
  try {
    const data = await fetchDetailedQueryData(readFilters(request))
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch detailed query data",
      },
      { status: 503 },
    )
  }
}
