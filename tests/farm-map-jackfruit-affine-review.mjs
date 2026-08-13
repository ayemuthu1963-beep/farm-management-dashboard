import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

const approvedName =
  "Muthu_Farms_Jackfruit_Tree_Coordinates_Affine_Corrected_Proposal_2026.geojson"
const approvedHash = "a5c6b63c753e517cd080ae19791f350dc8cdcb71ebdb1192316e032c6d50a539"
const normalizedAssetHash = (bytes) =>
  createHash("sha256")
    .update(bytes.toString("utf8").replaceAll("\r\n", "\n"))
    .digest("hex")

const approvedBytes = await readFile(`public/map-data/coordinates/${approvedName}`)
assert.equal(normalizedAssetHash(approvedBytes), approvedHash)
const collection = JSON.parse(approvedBytes.toString("utf8"))
assert.equal(collection.type, "FeatureCollection")
assert.equal(collection.features.length, 582)
assert.deepEqual(
  collection.features.map((feature) => feature.properties.treeNo),
  Array.from({ length: 582 }, (_, index) => String(index + 1)),
)
assert.equal(new Set(collection.features.map((feature) => feature.properties.canonicalId)).size, 582)
for (const feature of collection.features) {
  assert.deepEqual(Object.keys(feature.properties).sort(), ["canonicalId", "crop", "treeNo"])
  assert.equal(feature.properties.crop, "Jackfruit")
  assert.equal(feature.properties.canonicalId, `jackfruit:${feature.properties.treeNo}`)
  assert.equal(feature.geometry.type, "Point")
  assert.ok(feature.geometry.coordinates.every(Number.isFinite))
}
assert.doesNotMatch(approvedBytes.toString("utf8"), /classification|harvest|status|remark/i)

// Historical source and translation artifacts remain in the repository for evidence and rollback.
for (const [name, hash] of [
  ["Muthu_Farms_Jackfruit_Tree_Coordinates_Audit_2026.geojson", "c3964898cc53729d71fd509f79421d12c8e962110ea4e83084f633d1d66714f9"],
  ["Muthu_Farms_Jackfruit_Tree_Coordinates_Translated_Proposal_2026.geojson", "8bb62d4f9912256344469cf23a1f1407f7d89dbec510db14b988626f45da87a7"],
]) {
  assert.equal(normalizedAssetHash(await readFile(`public/map-data/coordinates/${name}`)), hash)
}

const mapData = await readFile("lib/farm-map-data.ts", "utf8")
const mapClient = await readFile("components/maps/farm-map-client.tsx", "utf8")
const nextConfig = await readFile("next.config.mjs", "utf8")

assert.match(mapData, new RegExp(approvedName.replaceAll(".", "\\.")))
assert.doesNotMatch(mapData, /Muthu_Farms_Jackfruit_Tree_Coordinates_Audit_2026/)
assert.doesNotMatch(mapData, /Muthu_Farms_Jackfruit_Tree_Coordinates_Translated_Proposal_2026/)
assert.match(nextConfig, new RegExp(approvedName.replaceAll(".", "\\.")))

assert.match(mapClient, /type JackfruitCoordinateVariant = "affine"/)
assert.match(mapClient, /Panel title="Jackfruit Trees"/)
assert.match(mapClient, /<span>Jackfruit Trees<\/span>/)
assert.match(mapClient, /approved Jackfruit coordinates loaded/)
assert.match(mapClient, /Approved Preview\/UAT coordinates/)
assert.match(mapClient, /Coordinate-only Jackfruit layer/)
assert.match(mapClient, /#dfff00/)
assert.match(mapClient, /applyJackfruitMapState\("affine"\)/)
assert.match(mapClient, /farmCombinedLayer\.jackfruitCoordinatesUrl/)
assert.match(mapClient, /map\.getZoom\(\) >= MARKER_ZOOM/)
assert.match(mapClient, /map\.getZoom\(\) >= LABEL_ZOOM/)
assert.doesNotMatch(mapClient, /Original Jackfruit points|Previous translation|review only|approval revoked|No Jackfruit coordinate layer is approved/)
assert.doesNotMatch(mapClient, /#ff00ff|#00e5ff/)
assert.doesNotMatch(mapClient, /jackfruitOriginalCoordinatesUrl|jackfruitTranslatedCoordinatesUrl/)

const coconutBytes = await readFile(
  "public/map-data/coordinates/Muthu_Farms_Coconut_Tree_Coordinates_Approved_2026.geojson",
)
assert.equal(
  normalizedAssetHash(coconutBytes),
  "9f2be88cb91df205a5e5a70625490ddcb11255d82808b167d45d368eb0ea77ce",
)
assert.equal(JSON.parse(coconutBytes.toString("utf8")).features.length, 2_117)

console.log("Preview approved Jackfruit affine coordinate cleanup contracts: PASS")
