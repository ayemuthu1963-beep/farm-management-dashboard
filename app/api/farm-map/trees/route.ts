import { brotliCompressSync, gzipSync } from "node:zlib"

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { fetchFarmMapTrees } from "@/lib/farm-map/server"

export const dynamic = "force-dynamic"

function operationalResponse(payload: unknown, acceptEncoding: string | null) {
  const body = Buffer.from(JSON.stringify(payload))
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json",
    Vary: "Accept-Encoding",
  })

  if (acceptEncoding?.match(/(?:^|,)\s*br(?:\s*;|\s*,|$)/i)) {
    headers.set("Content-Encoding", "br")
    return new NextResponse(Uint8Array.from(brotliCompressSync(body)), { headers })
  }
  if (acceptEncoding?.match(/(?:^|,)\s*gzip(?:\s*;|\s*,|$)/i)) {
    headers.set("Content-Encoding", "gzip")
    return new NextResponse(Uint8Array.from(gzipSync(body)), { headers })
  }
  return new NextResponse(body, { headers })
}

export async function GET(request: NextRequest) {
  try {
    return operationalResponse(
      await fetchFarmMapTrees(),
      request.headers.get("accept-encoding"),
    )
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
