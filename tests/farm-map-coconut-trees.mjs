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

const normalizedAssetHash = (bytes) =>
  createHash("sha256")
    .update(bytes.toString("utf8").replaceAll("\r\n", "\n"))
    .digest("hex")

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
assert.match(mapData, /Muthu_Farms_Jackfruit_Tree_Coordinates_Affine_Corrected_Proposal_2026\.geojson/)
assert.doesNotMatch(mapData, /Muthu_Farms_Jackfruit_Tree_Coordinates_Audit_2026\.geojson/)
assert.doesNotMatch(mapData, /Muthu_Farms_Jackfruit_Tree_Coordinates_Translated_Proposal_2026\.geojson/)
assert.match(mapData, /\/map-data\/orthomosaic\//)
assert.doesNotMatch(mapData, /farm-combined-png\/\{z\}/)

const nextConfig = await readFile("next.config.mjs", "utf8")
assert.match(nextConfig, /application\/octet-stream/)
assert.match(nextConfig, /application\/geo\+json/)
assert.match(nextConfig, /max-age=31536000, immutable/)
assert.match(nextConfig, /Muthu_Farms_Jackfruit_Tree_Coordinates_Translated_Proposal_2026\.geojson/)
assert.match(nextConfig, /Muthu_Farms_Jackfruit_Tree_Coordinates_Audit_2026\.geojson/)
assert.match(nextConfig, /Muthu_Farms_Jackfruit_Tree_Coordinates_Affine_Corrected_Proposal_2026\.geojson/)

const coordinateBytes = await readFile(
  "public/map-data/coordinates/Muthu_Farms_Coconut_Tree_Coordinates_Approved_2026.geojson",
)
assert.equal(
  normalizedAssetHash(coordinateBytes),
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

const jackfruitBytes = await readFile(
  "public/map-data/coordinates/Muthu_Farms_Jackfruit_Tree_Coordinates_Audit_2026.geojson",
)
assert.equal(
  normalizedAssetHash(jackfruitBytes),
  "c3964898cc53729d71fd509f79421d12c8e962110ea4e83084f633d1d66714f9",
)
const jackfruitCoordinates = JSON.parse(jackfruitBytes.toString("utf8"))
assert.equal(jackfruitCoordinates.type, "FeatureCollection")
assert.equal(jackfruitCoordinates.features.length, 582)
assert.equal(
  new Set(jackfruitCoordinates.features.map((feature) => feature.properties.canonicalId)).size,
  582,
)
assert.equal(
  Math.min(...jackfruitCoordinates.features.map((feature) => Number(feature.properties.treeNo))),
  1,
)
assert.equal(
  Math.max(...jackfruitCoordinates.features.map((feature) => Number(feature.properties.treeNo))),
  582,
)
for (const feature of jackfruitCoordinates.features) {
  assert.deepEqual(Object.keys(feature.properties).sort(), ["canonicalId", "crop", "treeNo"])
  assert.equal(feature.properties.crop, "Jackfruit")
  assert.equal(feature.properties.canonicalId, `jackfruit:${feature.properties.treeNo}`)
  assert.match(feature.properties.treeNo, /^[1-9]\d*$/)
  assert.equal(feature.geometry.type, "Point")
  assert.equal(feature.geometry.coordinates.length, 2)
  assert.ok(feature.geometry.coordinates.every(Number.isFinite))
}
assert.doesNotMatch(jackfruitBytes.toString("utf8"), /classification|harvest|status|remark/i)

const translatedJackfruitBytes = await readFile(
  "public/map-data/coordinates/Muthu_Farms_Jackfruit_Tree_Coordinates_Translated_Proposal_2026.geojson",
)
assert.equal(
  normalizedAssetHash(translatedJackfruitBytes),
  "8bb62d4f9912256344469cf23a1f1407f7d89dbec510db14b988626f45da87a7",
)
const translatedJackfruitCoordinates = JSON.parse(translatedJackfruitBytes.toString("utf8"))
assert.equal(translatedJackfruitCoordinates.features.length, 582)
assert.equal(
  new Set(
    translatedJackfruitCoordinates.features.map((feature) => feature.properties.canonicalId),
  ).size,
  582,
)
assert.deepEqual(
  translatedJackfruitCoordinates.features.map((feature) => feature.properties.treeNo),
  jackfruitCoordinates.features.map((feature) => feature.properties.treeNo),
)
for (const feature of translatedJackfruitCoordinates.features) {
  assert.deepEqual(Object.keys(feature.properties).sort(), ["canonicalId", "crop", "treeNo"])
  assert.equal(feature.properties.crop, "Jackfruit")
  assert.equal(feature.properties.canonicalId, `jackfruit:${feature.properties.treeNo}`)
  assert.equal(feature.geometry.type, "Point")
  assert.equal(feature.geometry.coordinates.length, 2)
  assert.ok(feature.geometry.coordinates.every(Number.isFinite))
}
assert.doesNotMatch(
  translatedJackfruitBytes.toString("utf8"),
  /classification|harvest|status|remark/i,
)
const cropSafeIds = new Set([
  ...coordinates.features.map((feature) => `coconut:${feature.properties.treeNo}`),
  ...translatedJackfruitCoordinates.features.map((feature) => feature.properties.canonicalId),
])
assert.equal(cropSafeIds.size, 2_117 + 582)

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
assert.match(mapClient, /const EXPECTED_JACKFRUIT_COUNT = 582/)
assert.match(mapClient, /EXPECTED_COCONUT_PLOT_COUNTS/)
assert.match(mapClient, /plotNameForTreeNo\(treeNo\)/)
assert.match(mapClient, /leaflet\.canvas\(\{ padding: 0\.5 \}\)/)
assert.match(mapClient, /getBounds\(\)\.pad\(0\.08\)/)
assert.match(mapClient, /\/api\/farm-map\/trees/)
assert.match(mapClient, /canonicalTreeNo/)
assert.match(mapClient, /tree-view\?treeNo=/)
assert.match(mapClient, /Refresh current classifications/)
assert.match(mapClient, /Unknown\/unmatched/)
assert.match(mapClient, /grey does not mean Sapling/)
assert.match(mapClient, /Operational data as of/)
assert.match(mapClient, /Plot 1: 1,163 coordinates · Plot 2: 954 coordinates/)
assert.match(mapClient, /Panel title="Jackfruit Trees"/)
assert.match(mapClient, /farmCombinedLayer\.jackfruitCoordinatesUrl/)
assert.match(mapClient, /validateJackfruitCoordinateCollection/)
assert.match(mapClient, /jackfruit:\$\{treeNo\}/)
assert.match(mapClient, /#dfff00/)
assert.match(mapClient, /map\.getZoom\(\) >= MARKER_ZOOM/)
assert.match(mapClient, /map\.getZoom\(\) >= LABEL_ZOOM/)
assert.match(mapClient, /Jackfruit Tree Number/)
assert.match(mapClient, /not joined to coconut performance classifications/)
assert.doesNotMatch(mapClient, /Original Jackfruit points|Previous translation|review only|approval revoked/)
assert.match(mapClient, /JackfruitCoordinateVariant/)
assert.doesNotMatch(mapClient, /Good|Inconsistent|Critical/)
assert.doesNotMatch(mapClient, /fillColor: "#0f766e"/)
for (const colour of Object.values(expectedColours)) {
  assert.doesNotMatch(mapClient, new RegExp(colour, "i"))
}

const proxyRoute = await readFile("app/api/farm-map/trees/route.ts", "utf8")
assert.match(proxyRoute, /fetchFarmMapTrees/)
assert.match(proxyRoute, /Farm Map operational data is temporarily unavailable/)
assert.match(proxyRoute, /brotliCompressSync/)
assert.match(proxyRoute, /gzipSync/)
assert.match(proxyRoute, /Content-Encoding/)
assert.match(proxyRoute, /Vary: "Accept-Encoding"/)
assert.match(proxyRoute, /Cache-Control": "private, no-store"/)
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
