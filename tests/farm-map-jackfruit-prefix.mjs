import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  formatJackfruitTreeNo,
  parseJackfruitTreeSearch,
} from "../lib/farm-map/jackfruit-tree-number.ts"

for (const treeNo of ["1", "186", "582"]) {
  assert.equal(formatJackfruitTreeNo(treeNo), `J:${treeNo}`)
  assert.equal(parseJackfruitTreeSearch(`J:${treeNo}`), treeNo)
  assert.equal(parseJackfruitTreeSearch(`j:${treeNo}`), treeNo)
  assert.equal(parseJackfruitTreeSearch(`JF:${treeNo}`), treeNo)
  assert.equal(parseJackfruitTreeSearch(`jf: ${treeNo}`), treeNo)
}
assert.equal(parseJackfruitTreeSearch("1"), null)
assert.equal(parseJackfruitTreeSearch("C:1"), null)
assert.equal(parseJackfruitTreeSearch("J:0"), null)
assert.equal(parseJackfruitTreeSearch("J:583x"), null)

const mapClient = await readFile("components/maps/farm-map-client.tsx", "utf8")
const autocomplete = await readFile("components/harvest/tree-number-autocomplete.tsx", "utf8")

// Current approved TreeNos are displayed verbatim, with crop presented separately.
assert.match(mapClient, /TreeNo: \$\{treeNo\}/)
assert.doesNotMatch(mapClient, /formatJackfruitTreeNo|parseJackfruitTreeSearch/)
await import("./farm-map-three-crops.mjs")
assert.match(autocomplete, /onValueChange\(formatTreeNo\(option\.treeNo\)\)/)
assert.match(autocomplete, /\{formatTreeNo\(option\.treeNo\)\}/)

console.log("Preview Jackfruit J-prefix display and JF input-alias contracts: PASS")
