import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const params = new URLSearchParams()
  const plot = searchParams.get("plot")
  const category = searchParams.get("category")

  if (plot) {
    params.set("plot", plot)
  }
  if (category) {
    params.set("category", category)
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured" }, { status: 503 })
  }

  const response = await fetch(`${getApiBaseUrl()}/api/export/tree-performance-xlsx?${params.toString()}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return NextResponse.json({ error: `Harvest API returned ${response.status}` }, { status: 503 })
  }

  const body = await response.arrayBuffer()
  const filename =
    plot && category
      ? `${plot.toLowerCase().replaceAll(" ", "-")}-${category.toLowerCase().replaceAll(" ", "-")}-tree-performance.xlsx`
      : "all-tree-performance.xlsx"

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  })
}
