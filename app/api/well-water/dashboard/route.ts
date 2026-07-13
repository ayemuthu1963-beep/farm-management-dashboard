import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const headers: HeadersInit = {}
  const authHeader = getBasicAuthHeader()

  if (authHeader) {
    headers.Authorization = authHeader
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/well-water/dashboard?${searchParams.toString()}`, {
      headers,
      cache: "no-store",
    })

    const payload = await response.json()

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status })
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch Well Water dashboard data",
      },
      { status: 503 },
    )
  }
}
