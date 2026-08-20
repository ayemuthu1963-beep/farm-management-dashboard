import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export async function GET(request: Request) {
  const incoming = new URL(request.url)
  const date = incoming.searchParams.get("date")
  const from = incoming.searchParams.get("from")
  const to = incoming.searchParams.get("to")
  const refresh = incoming.searchParams.get("refresh")
  const useSingleDate = validDate(date)
  const useDateRange = validDate(from) && validDate(to) && from <= to

  if (!(useSingleDate || useDateRange)) {
    return NextResponse.json({ error: "Select a valid harvest date or date range." }, { status: 400 })
  }

  const configuredUpstream = process.env.HARVEST_COUNTER_PUBLIC_API_URL?.trim()
  if (!configuredUpstream) {
    return NextResponse.json(
      { error: "Harvest counter upstream is not configured." },
      { status: 503 },
    )
  }

  let upstream: URL
  try {
    upstream = new URL(configuredUpstream)
  } catch {
    return NextResponse.json(
      { error: "Harvest counter upstream configuration is invalid." },
      { status: 503 },
    )
  }

  if (upstream.protocol !== "http:" && upstream.protocol !== "https:") {
    return NextResponse.json(
      { error: "Harvest counter upstream configuration is invalid." },
      { status: 503 },
    )
  }
  if (useSingleDate) {
    upstream.searchParams.set("date", date)
  } else {
    upstream.searchParams.set("from", from!)
    upstream.searchParams.set("to", to!)
  }
  if (refresh === "1" || refresh === "true") upstream.searchParams.set("refresh", "1")

  try {
    const response = await fetch(upstream, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    })
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Harvest totals are temporarily unavailable." }, { status: 503 })
  }
}
