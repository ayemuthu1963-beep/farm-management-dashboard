export type Coordinate = [number, number]

export interface FarmCombinedLayer {
  id: "farm-combined"
  name: string
  tileUrl: string
  bounds: Coordinate[]
  center: Coordinate
  minZoom: number
  maxZoom: number
  defaultZoom: number
  initialPresentationZoom: number
  attribution: string
  metadata: {
    source: string
    webCrs: string
    zoomLevels: string
    tileFormat: string
    folder: string
  }
}

export const plotBounds: Record<"plot1" | "plot2", Coordinate[]> = {
  plot1: [
    [10.482652551772594, 77.07430077337982],
    [10.482550944015463, 77.07571125122914],
    [10.482411056468303, 77.075704984045],
    [10.482294212211487, 77.07702199218696],
    [10.480233801779807, 77.07678418202109],
    [10.480695393467956, 77.07401831861797],
    [10.481259972338133, 77.07408209707859],
    [10.481817596347597, 77.07399777876941],
    [10.482460213098062, 77.07403806903481],
    [10.482580872490344, 77.07415891385517],
    [10.482652551772594, 77.07430077337982],
  ],
  plot2: [
    [10.479800009411838, 77.07669168370259],
    [10.479777736808021, 77.0801008646421],
    [10.482284732320126, 77.08011760075026],
    [10.482307010368135, 77.0767083924292],
    [10.479800009411838, 77.07669168370259],
  ],
}

export const farmCombinedLayer: FarmCombinedLayer = {
  id: "farm-combined",
  name: "Farm Combined Orthomosaic",
  tileUrl: "/map-tiles/farm-combined-png/{z}/{x}/{y}.png",
  bounds: [...plotBounds.plot1, ...plotBounds.plot2],
  center: [10.4812, 77.077],
  minZoom: 16,
  maxZoom: 22,
  defaultZoom: 18,
  initialPresentationZoom: 17.8,
  attribution: "",
  metadata: {
    source: "Combined Plot 1 and Plot 2 XYZ tile package",
    webCrs: "EPSG:3857",
    zoomLevels: "16 to 22",
    tileFormat: "PNG",
    folder: "/home/muthu/mfms-map-data/web_tiles/farm-combined-png",
  },
}
