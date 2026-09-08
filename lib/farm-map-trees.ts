export const FARM_CROPS = ["Coconut", "Jackfruit", "Nutmeg"] as const
export type FarmCrop = (typeof FARM_CROPS)[number]
export type CoconutPlot = "Plot 1" | "Plot 2"

export interface FarmMapTree {
  key: string
  crop: FarmCrop
  treeNo: string
  coordinates: [number, number]
  plot?: CoconutPlot
}

export const CROP_STYLES: Record<FarmCrop, { colour: string; count: number }> = {
  Coconut: { colour: "#0f766e", count: 2117 },
  Jackfruit: { colour: "#f97316", count: 623 },
  Nutmeg: { colour: "#9333ea", count: 693 },
}

export const FARM_TREE_SOURCES: ReadonlyArray<{
  crop: FarmCrop
  plot?: CoconutPlot
  url: string
  count: number
}> = [
  { crop: "Coconut", plot: "Plot 1", url: "/map-data/vector/plot1-coconut-trees-v1.geojson", count: 954 },
  { crop: "Coconut", plot: "Plot 2", url: "/map-data/vector/plot2-coconut-trees-v1.geojson", count: 1163 },
  { crop: "Jackfruit", url: "/map-data/vector/jackfruit-trees-ffbcd4efe04a955b.geojson", count: 623 },
  { crop: "Nutmeg", url: "/map-data/vector/nutmeg-trees-92968dc1573b3b2e.geojson", count: 693 },
]

export function farmTreeKey(crop: FarmCrop, treeNo: string) {
  return `${crop}\u0000${treeNo}`
}

export function readFarmTreeCollection(value: unknown, source: (typeof FARM_TREE_SOURCES)[number]): FarmMapTree[] {
  const collection = value as { type?: unknown; features?: unknown[] } | null
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== source.count) {
    throw new Error(`Invalid ${source.crop} tree collection`)
  }
  const keys = new Set<string>()
  return collection.features.map((value) => {
    const feature = value as {
      type?: unknown
      geometry?: { type?: unknown; coordinates?: unknown[] }
      properties?: Record<string, unknown>
    } | null
    const properties = feature?.properties
    const treeNo = source.crop === "Coconut" ? properties?.TreeNo : properties?.tree_no
    const coordinates = feature?.geometry?.coordinates
    if (
      feature?.type !== "Feature" || feature.geometry?.type !== "Point" ||
      !Array.isArray(coordinates) || coordinates.length !== 2 ||
      !coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)) ||
      Math.abs(coordinates[0] as number) > 180 || Math.abs(coordinates[1] as number) > 90 ||
      typeof treeNo !== "string" || treeNo.trim() !== treeNo || !/^\d+(?:\.\d+)?$/.test(treeNo) || /\.0+$/.test(treeNo) ||
      (source.crop === "Coconut" ? properties?.Plot !== source.plot : properties?.crop !== source.crop)
    ) throw new Error(`Invalid ${source.crop} tree feature`)
    const key = farmTreeKey(source.crop, treeNo)
    if (keys.has(key)) throw new Error(`Duplicate ${source.crop} tree number`)
    keys.add(key)
    return { key, crop: source.crop, treeNo, coordinates: coordinates as [number, number], plot: source.plot }
  })
}

export interface LabelCandidate { key: string; treeNo: string; x: number; y: number }

/** Keep labels inside the viewport with no overlapping text boxes and a bounded DOM cost. */
export function visibleFarmLabelKeys(candidates: LabelCandidate[], width: number, height: number, limit = 180): Set<string> {
  const selected = new Set<string>()
  const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = []
  for (const candidate of candidates) {
    const halfWidth = Math.max(14, candidate.treeNo.length * 3.6 + 5)
    const box = { left: candidate.x - halfWidth, right: candidate.x + halfWidth, top: candidate.y - 26, bottom: candidate.y - 6 }
    if (box.left < 0 || box.right > width || box.top < 0 || box.bottom > height) continue
    if (occupied.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue
    occupied.push(box)
    selected.add(candidate.key)
    if (selected.size >= limit) break
  }
  return selected
}
