import { readFile } from "node:fs/promises"
import path from "node:path"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DEFAULT_TILE_ROOT = "C:\\MFMS_LOCAL\\map-data\\web_tiles\\farm-combined-png"
const TILE_ROOT = path.resolve(process.env.MFMS_LOCAL_TILE_ROOT ?? DEFAULT_TILE_ROOT)
const INTEGER_PATTERN = /^\d+$/
const PNG_SIGNATURE = "89504e470d0a1a0a"

interface TileRouteParams {
  params: Promise<{
    z: string
    x: string
    y: string
  }>
}

function notFound() {
  return new Response("Not found", { status: 404 })
}

function safeTilePath(z: string, x: string, ySegment: string): string | null {
  if (!INTEGER_PATTERN.test(z) || !INTEGER_PATTERN.test(x) || !ySegment.endsWith(".png")) {
    return null
  }

  const y = ySegment.slice(0, -4)
  if (!INTEGER_PATTERN.test(y)) {
    return null
  }

  const tilePath = path.resolve(TILE_ROOT, z, x, `${y}.png`)
  const relativePath = path.relative(TILE_ROOT, tilePath)

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null
  }

  return tilePath
}

function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).toString("hex") === PNG_SIGNATURE
}

export async function GET(_request: Request, { params }: TileRouteParams) {
  const { z, x, y } = await params
  const tilePath = safeTilePath(z, x, y)

  if (!tilePath) {
    return notFound()
  }

  try {
    const tile = await readFile(tilePath)

    if (!isPng(tile)) {
      return notFound()
    }

    return new Response(new Uint8Array(tile), {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Length": String(tile.byteLength),
        "Content-Type": "image/png",
      },
    })
  } catch {
    return notFound()
  }
}
