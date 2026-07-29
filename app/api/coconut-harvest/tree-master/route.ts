import { NextResponse } from "next/server"

import { fetchAllTreeNumbers } from "@/lib/coconut-harvest-api"

const CACHE_MS = 15 * 60 * 1000

let cachedTreeNumbers: { expiresAt: number; values: string[] } | null = null
let pendingTreeNumbers: Promise<string[]> | null = null

async function loadTreeNumbers() {
  if (cachedTreeNumbers && cachedTreeNumbers.expiresAt > Date.now()) {
    return cachedTreeNumbers.values
  }
  if (!pendingTreeNumbers) {
    pendingTreeNumbers = fetchAllTreeNumbers()
      .then((values) => {
        cachedTreeNumbers = { expiresAt: Date.now() + CACHE_MS, values }
        return values
      })
      .finally(() => {
        pendingTreeNumbers = null
      })
  }
  return pendingTreeNumbers
}

export async function GET() {
  try {
    const treeNumbers = await loadTreeNumbers()
    return NextResponse.json(
      {
        source: "TREE MASTER",
        treeNumbers,
        total: treeNumbers.length,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load Tree Numbers",
      },
      { status: 503 },
    )
  }
}
