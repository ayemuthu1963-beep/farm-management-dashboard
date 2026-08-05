import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const definitions = [
  {
    plot: "Plot 1",
    path: "public/map-data/vector/plot1-coconut-trees-v1.geojson",
    expectedCount: 954,
    expectedDecimals: 9,
    bounds: {
      minLongitude: 77.07399777876941,
      maxLongitude: 77.07702199218696,
      minLatitude: 10.480233801779807,
      maxLatitude: 10.482652551772594,
    },
  },
  {
    plot: "Plot 2",
    path: "public/map-data/vector/plot2-coconut-trees-v1.geojson",
    expectedCount: 1163,
    expectedDecimals: 6,
    bounds: {
      minLongitude: 77.07669168370259,
      maxLongitude: 77.08011760075026,
      minLatitude: 10.479777736808021,
      maxLatitude: 10.482307010368135,
    },
  },
]

const allTreeNumbers = new Set()
const decimalTreeNumbersByPlot = new Map()

for (const definition of definitions) {
  const collection = JSON.parse(await readFile(definition.path, "utf8"))
  assert.equal(collection.type, "FeatureCollection")
  assert.equal(collection.features.length, definition.expectedCount)

  const withinPlot = collection.features.filter((feature) => {
    assert.equal(feature.type, "Feature")
    assert.equal(feature.geometry.type, "Point")
    assert.equal(typeof feature.properties.TreeNo, "string")
    assert.equal(feature.properties.Plot, definition.plot)
    assert.ok(feature.properties.TreeNo.length > 0)

    const [longitude, latitude] = feature.geometry.coordinates
    assert.ok(Number.isFinite(longitude) && Number.isFinite(latitude))
    return (
      longitude >= definition.bounds.minLongitude &&
      longitude <= definition.bounds.maxLongitude &&
      latitude >= definition.bounds.minLatitude &&
      latitude <= definition.bounds.maxLatitude
    )
  })
  assert.equal(withinPlot.length, definition.expectedCount)

  const treeNumbers = collection.features.map((feature) => feature.properties.TreeNo)
  assert.equal(new Set(treeNumbers).size, treeNumbers.length)
  assert.equal(
    treeNumbers.filter((treeNo) => treeNo.includes(".") && !/\.0+$/.test(treeNo)).length,
    definition.expectedDecimals,
  )
  decimalTreeNumbersByPlot.set(
    definition.plot,
    treeNumbers.find((treeNo) => treeNo.includes(".") && !/\.0+$/.test(treeNo)),
  )

  for (const treeNo of treeNumbers) {
    assert.ok(!allTreeNumbers.has(treeNo), `TreeNo ${treeNo} appears in both plots`)
    allTreeNumbers.add(treeNo)
  }
}

assert.equal(allTreeNumbers.size, 2117)
assert.ok(allTreeNumbers.has(decimalTreeNumbersByPlot.get("Plot 1")))
assert.ok(allTreeNumbers.has(decimalTreeNumbersByPlot.get("Plot 2")))

const mapClient = await readFile("components/maps/farm-map-client.tsx", "utf8")
assert.match(mapClient, /const MARKER_ZOOM = 18/)
assert.match(mapClient, /const LABEL_ZOOM = 20/)
assert.match(mapClient, /Tree Numbers/)
assert.match(mapClient, /Plot 1 &amp; Plot 2/)
assert.doesNotMatch(mapClient, /All Plots/)
assert.match(mapClient, /useState<PlotFilter>\("Plot 1 & Plot 2"\)/)
assert.match(mapClient, /useRef<PlotFilter>\("Plot 1 & Plot 2"\)/)
assert.match(
  mapClient,
  /Tree found in \$\{treePlot\}\. Select \$\{treePlot\} or Plot 1 & Plot 2\./,
)
assert.match(mapClient, /Plot 1/)
assert.match(mapClient, /Plot 2/)
assert.match(mapClient, /encodeURIComponent\(treeNo\)/)
assert.match(mapClient, /tree-view\?treeNo=/)
assert.match(mapClient, /difference|Harvest data/i)
assert.match(mapClient, /\/api\/farm-map\/tree-classifications/)
assert.match(mapClient, /"Century Maker": \{ background: "#166534"/)
assert.match(mapClient, /"Match Winner": \{ background: "#15803d"/)
assert.match(mapClient, /"Reliable Batter": \{ background: "#1d4ed8"/)
assert.match(mapClient, /"Tail Ender": \{ background: "#f59e0b", text: "#111827"/)
assert.match(mapClient, /"Bench Player": \{ background: "#b91c1c"/)
assert.match(mapClient, /"Future Better": \{ background: "#7e22ce"/)
assert.match(mapClient, /fillColor: "#0f766e"/)
assert.match(mapClient, /entry\.label\.setIcon\(treeLabelIcon\(leaflet, treeNo, classifications\.get\(treeNo\)\)\)/)
assert.match(mapClient, /Tree Classification Colour Legend/)
assert.match(mapClient, /Plot 1: Tree numbers 1 to 999/)
assert.match(mapClient, /Plot 2: Tree numbers above 1000/)
assert.match(mapClient, /Over 400 nuts in last 10 harvests/)
assert.match(mapClient, /200 to 299 nuts in last 10 harvests/)
assert.match(mapClient, /Saplings under 36 completed months/)
assert.match(mapClient, />\s*1234\s*</)
assert.match(mapClient, /contentBelowMap=\{<TreeClassificationLegend \/>\}/)

const orthomosaicMap = await readFile(
  "components/maps/farm-orthomosaic-map.tsx",
  "utf8",
)
assert.match(
  orthomosaicMap,
  /detailsPanel \? <div className="xl:col-start-1">\{detailsPanel\}<\/div>/,
)
assert.match(
  orthomosaicMap,
  /notePanel \? <div className="xl:col-start-2 xl:self-start">\{notePanel\}<\/div>/,
)
const legendPosition = orthomosaicMap.indexOf(
  '{contentBelowMap ? <div className="xl:col-span-2">',
)
const detailsPosition = orthomosaicMap.indexOf(
  '{detailsPanel ? <div className="xl:col-start-1">',
)
assert.ok(legendPosition >= 0)
assert.ok(detailsPosition > legendPosition)

const route = await readFile(
  "app/api/farm-map/trees/[treeNo]/harvest-summary/route.ts",
  "utf8",
)
assert.match(route, /fetchFarmMapTreeHarvestSummary/)

const classificationRoute = await readFile(
  "app/api/farm-map/tree-classifications/route.ts",
  "utf8",
)
assert.match(classificationRoute, /fetchFarmMapTreeClassifications/)

console.log(`Farm Map coconut-tree checks passed for ${allTreeNumbers.size} trees.`)
