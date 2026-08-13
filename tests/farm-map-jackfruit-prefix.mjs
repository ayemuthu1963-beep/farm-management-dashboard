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

assert.match(mapClient, /const label = formatJackfruitTreeNo\(treeNo\)/)
assert.match(mapClient, /Jackfruit Tree Number<\/th>[\s\S]*escapeHtml\(displayTreeNo\)/)
assert.match(mapClient, /Jackfruit tree \$\{formatJackfruitTreeNo/)
assert.match(mapClient, /Jackfruit Tree Number search/)
assert.match(mapClient, /placeholder="J:<TreeNo>, e\.g\. J:186"/)
assert.match(mapClient, /Legacy JF:&lt;TreeNo&gt; input is also accepted/)
assert.match(mapClient, /formatTreeNo=\{formatJackfruitTreeNo\}/)
assert.match(mapClient, /normalizeInput=\{parseJackfruitTreeSearch\}/)
assert.match(mapClient, /aria-label="Jackfruit tree \$\{label\}"/)
assert.doesNotMatch(mapClient, /`JF:\$\{treeNo\}`/)
assert.match(autocomplete, /onValueChange\(formatTreeNo\(option\.treeNo\)\)/)
assert.match(autocomplete, /\{formatTreeNo\(option\.treeNo\)\}/)

console.log("Preview Jackfruit J-prefix display and JF input-alias contracts: PASS")
