import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

import {
  CLASSIFICATION_STYLES,
  PERFORMANCE_CLASSIFICATIONS,
  UNKNOWN_CLASSIFICATION_STYLE,
  classificationFilterKey,
} from "../lib/farm-map/classification-styles.ts"
import { canonicalTreeNo } from "../lib/farm-map/tree-number.ts"

const expectedColours = {
  "Century Maker": "#166534",
  "Match Winner": "#15803d",
  "Reliable Batter": "#1d4ed8",
  "Tail Ender": "#f59e0b",
  "Bench Player": "#b91c1c",
  "Future Better": "#7e22ce",
}

assert.deepEqual([...PERFORMANCE_CLASSIFICATIONS], Object.keys(expectedColours))
for (const [classification, colour] of Object.entries(expectedColours)) {
  assert.equal(CLASSIFICATION_STYLES[classification].fill, colour)
  assert.ok(CLASSIFICATION_STYLES[classification].border)
  assert.ok(CLASSIFICATION_STYLES[classification].selectedBorder)
}
assert.notEqual(UNKNOWN_CLASSIFICATION_STYLE.fill, CLASSIFICATION_STYLES["Future Better"].fill)
assert.equal(classificationFilterKey(null), "Unknown/unmatched")
assert.equal(classificationFilterKey("Sapling"), "Unknown/unmatched")
assert.equal(classificationFilterKey("Future Better"), "Future Better")

for (const [source, expected] of [
  ["123", "123"],
  [" 123.0 ", "123"],
  ["00035.1000", "35.1"],
  ["35.1", "35.1"],
]) {
  assert.equal(canonicalTreeNo(source), expected)
}
for (const invalid of ["", "35A", "35..1", "35,1", "-1", null]) {
  assert.equal(canonicalTreeNo(invalid), null)
}

const mapData = await readFile("lib/farm-map-data.ts", "utf8")
assert.match(mapData, /Muthu_Farms_Full_Orthomosaic_2026_WebMercator_Z16-Z22_WebP88\.pmtiles/)
assert.match(mapData, /Muthu_Farms_Coconut_Tree_Coordinates_Approved_2026\.geojson/)
assert.match(mapData, /\/map-data\/orthomosaic\//)
assert.doesNotMatch(mapData, /farm-combined-png\/\{z\}/)

const nextConfig = await readFile("next.config.mjs", "utf8")
assert.match(nextConfig, /application\/octet-stream/)
assert.match(nextConfig, /application\/geo\+json/)
assert.match(nextConfig, /max-age=31536000, immutable/)

const coordinateBytes = await readFile(
  "public/map-data/coordinates/Muthu_Farms_Coconut_Tree_Coordinates_Approved_2026.geojson",
)
assert.equal(
  createHash("sha256").update(coordinateBytes).digest("hex"),
  "9f2be88cb91df205a5e5a70625490ddcb11255d82808b167d45d368eb0ea77ce",
)
const coordinates = JSON.parse(coordinateBytes.toString("utf8"))
assert.equal(coordinates.features.length, 2_117)
assert.equal(coordinates.features.filter((feature) => feature.properties.plot === "Plot 1").length, 954)
assert.equal(coordinates.features.filter((feature) => feature.properties.plot === "Plot 2").length, 1_163)
assert.equal(new Set(coordinates.features.map((feature) => feature.properties.treeNo)).size, 2_117)
assert.equal(
  coordinates.features.filter((feature) => feature.properties.treeNo.includes(".")).length,
  15,
)
for (const feature of coordinates.features) {
  assert.deepEqual(Object.keys(feature.properties).sort(), [
    "coordinateSource",
    "coordinateVersion",
    "plot",
    "treeNo",
  ])
}

const orthomosaicMap = await readFile("components/maps/farm-orthomosaic-map.tsx", "utf8")
assert.match(orthomosaicMap, /new PMTiles\(farmCombinedLayer\.pmtilesUrl\)/)
assert.match(orthomosaicMap, /leafletRasterLayer/)
assert.match(orthomosaicMap, /TileType\.Webp/)
assert.match(orthomosaicMap, /Orthomosaic opacity/)
assert.match(orthomosaicMap, /maxNativeZoom: 22/)

const mapClient = await readFile("components/maps/farm-map-client.tsx", "utf8")
assert.match(mapClient, /const MARKER_ZOOM = 18/)
assert.match(mapClient, /const LABEL_ZOOM = 20/)
assert.match(mapClient, /const EXPECTED_TREE_COUNT = 2_117/)
assert.match(mapClient, /"Plot 1": 954, "Plot 2": 1_163/)
assert.match(mapClient, /leaflet\.canvas\(\{ padding: 0\.5 \}\)/)
assert.match(mapClient, /getBounds\(\)\.pad\(0\.08\)/)
assert.match(mapClient, /\/api\/farm-map\/trees/)
assert.match(mapClient, /canonicalTreeNo/)
assert.match(mapClient, /tree-view\?treeNo=/)
assert.match(mapClient, /Refresh current classifications/)
assert.match(mapClient, /Unknown\/unmatched/)
assert.match(mapClient, /grey does not mean Sapling/)
assert.match(mapClient, /Operational data as of/)
assert.match(mapClient, /Plot 1: 954 corrected coordinates/)
assert.doesNotMatch(mapClient, /Good|Inconsistent|Critical/)
assert.doesNotMatch(mapClient, /fillColor: "#0f766e"/)
for (const colour of Object.values(expectedColours)) {
  assert.doesNotMatch(mapClient, new RegExp(colour, "i"))
}

const proxyRoute = await readFile("app/api/farm-map/trees/route.ts", "utf8")
assert.match(proxyRoute, /fetchFarmMapTrees/)
assert.match(proxyRoute, /Farm Map operational data is temporarily unavailable/)
assert.doesNotMatch(proxyRoute, /Authorization|HARVEST_API_PASSWORD/)

const serverFetch = await readFile("lib/farm-map/server.ts", "utf8")
assert.match(serverFetch, /PRODUCTION_LOOPBACK_PORT/)
assert.match(serverFetch, /recordCount !== 2_117/)
assert.match(serverFetch, /decimalTreeNoCount !== 15/)
assert.doesNotMatch(serverFetch, /tree_master|gps_latitude|gps_longitude/)

const packageJson = JSON.parse(await readFile("package.json", "utf8"))
assert.equal(packageJson.dependencies.leaflet, "1.9.4")
assert.equal(packageJson.dependencies.pmtiles, "4.5.0")

console.log("Preview Farm Map PMTiles, coordinate, join, and style contracts: PASS")
