import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { CROP_STYLES, FARM_TREE_SOURCES, farmTreeKey, readFarmTreeCollection, visibleFarmLabelKeys } from "../lib/farm-map-trees.ts"
import { shouldLoadPageAnalytics } from "../lib/farm-map-analytics.ts"

for (const path of ["/farm-map", "/farm-map/"]) assert.equal(shouldLoadPageAnalytics(path), false)
for (const path of [null, "/", "/coconut-harvest", "/pipeline-layout", "/farm-map-other"]) assert.equal(shouldLoadPageAnalytics(path), true)

const expectedHashes = {
  Jackfruit: "ffbcd4efe04a955b25382c414ebf547ffedafee51d3b8227454aab716835bba4",
  Nutmeg: "92968dc1573b3b2e07ba2aa95e60ac3d6b665c3cdd8df40e4925f949b910d43d",
}
const expectedDecimals = {
  Jackfruit: ["6.1", "53.1", "54.1", "118.1", "169.1", "191.1"],
  Nutmeg: ["551.1", "693.1"],
}
const trees = []
for (const source of FARM_TREE_SOURCES) {
  const bytes = await readFile(`public${source.url}`)
  const data = JSON.parse(bytes)
  const loaded = readFarmTreeCollection(data, source)
  assert.equal(loaded.length, source.count)
  assert.deepEqual(loaded.map((tree) => tree.coordinates), data.features.map((feature) => feature.geometry.coordinates))
  trees.push(...loaded)
  if (source.crop === "Coconut") continue
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHashes[source.crop])
  for (const feature of data.features) {
    assert.deepEqual(Object.keys(feature).sort(), ["geometry", "properties", "type"])
    assert.deepEqual(Object.keys(feature.properties).sort(), ["crop", "tree_no"])
  }
  assert.deepEqual(loaded.filter((tree) => tree.treeNo.includes(".")).map((tree) => tree.treeNo).sort(), expectedDecimals[source.crop].toSorted())
  const duplicate = structuredClone(data)
  duplicate.features[1].properties.tree_no = duplicate.features[0].properties.tree_no
  assert.throws(() => readFarmTreeCollection(duplicate, source), /Duplicate/)
  const numeric = structuredClone(data)
  numeric.features[0].properties.tree_no = 1
  assert.throws(() => readFarmTreeCollection(numeric, source), /Invalid/)
  const blank = structuredClone(data)
  blank.features[0].properties.tree_no = ""
  assert.throws(() => readFarmTreeCollection(blank, source), /Invalid/)
}
assert.equal(trees.length, 3433)
assert.equal(new Set(trees.map((tree) => tree.key)).size, 3433)
for (const crop of ["Coconut", "Jackfruit", "Nutmeg"]) assert.equal(trees.filter((tree) => tree.crop === crop).length, CROP_STYLES[crop].count)
assert.notEqual(farmTreeKey("Coconut", "1"), farmTreeKey("Jackfruit", "1"))
assert.notEqual(farmTreeKey("Nutmeg", "551.1"), farmTreeKey("Nutmeg", "551"))
assert.equal(trees.find((tree) => tree.key === farmTreeKey("Nutmeg", "551.1")).treeNo, "551.1")

assert.deepEqual([...visibleFarmLabelKeys([
  { key: "selected", treeNo: "551.1", x: 50, y: 50 },
  { key: "overlap", treeNo: "12", x: 52, y: 51 },
  { key: "separate", treeNo: "693.1", x: 150, y: 50 },
  { key: "outside", treeNo: "7", x: -5, y: 50 },
], 200, 100)], ["selected", "separate"])
assert.equal(visibleFarmLabelKeys(Array.from({ length: 400 }, (_, i) => ({ key: String(i), treeNo: "1", x: 40 + (i % 20) * 40, y: 40 + Math.floor(i / 20) * 40 })), 1000, 1000).size, 180)

const map = await readFile("components/maps/farm-map-client.tsx", "utf8")
assert.match(map, /Coconut: true, Jackfruit: true, Nutmeg: true/)
assert.match(map, /preferCanvas/)
assert.match(map, /tree\.crop !== "Coconut"\) return/)
assert.doesNotMatch(map, /parseInt|parseFloat|tree-master/)
const layer = await readFile("lib/farm-map-layer.ts", "utf8")
assert.match(layer, /full-farm-0db33c684af256b0\.pmtiles/)
assert.doesNotMatch(layer, /\/home\/|[A-Z]:\\/)
console.log("Farm Map three-crop data, exact identity, sanitization, immutable hashes and label-collision checks: PASS (3433 trees)")
