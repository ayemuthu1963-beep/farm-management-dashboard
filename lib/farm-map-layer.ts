import type { Coordinate } from "@/lib/farm-map-data"

export interface FarmMapLayer {
  name: string
  pmtilesUrl: string
  bounds: Coordinate[]
  center: Coordinate
  minZoom: number
  maxZoom: number
  defaultZoom: number
  attribution: string
  metadata: { source: string; webCrs: string; zoomLevels: string; tileFormat: string }
}

export const farmMapLayer: FarmMapLayer = {
  name: "Muthu Farms Full Orthomosaic 2026",
  pmtilesUrl: "/map-tiles/farm-combined-png/full-farm-0db33c684af256b0.pmtiles",
  bounds: [[10.478420289759173, 77.07394402892976], [10.482693066048213, 77.08011796141264]],
  center: [10.4805567, 77.0770309],
  minZoom: 16,
  maxZoom: 22,
  defaultZoom: 18,
  attribution: "",
  metadata: {
    source: "Approved full-farm orthomosaic",
    webCrs: "EPSG:3857",
    zoomLevels: "16 to 22",
    tileFormat: "WebP with transparency in PMTiles",
  },
}
