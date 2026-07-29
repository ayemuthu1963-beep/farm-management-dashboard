import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  compareTreeNumbers,
  rankTreeNumberOptions,
  treeNumberOptionKey,
  treeNumberSuggestionsUrl,
} from "../lib/tree-number-options.ts"

const naturalOrder = ["11", "2.1", "1", "10", "3", "2"].sort(compareTreeNumbers)
assert.deepEqual(naturalOrder, ["1", "2", "2.1", "3", "10", "11"])

const options = [
  { key: treeNumberOptionKey("1", "Plot 1"), treeNo: "1", plot: "Plot 1" },
  { key: treeNumberOptionKey("10", "Plot 1"), treeNo: "10", plot: "Plot 1" },
  { key: treeNumberOptionKey("11", "Plot 1"), treeNo: "11", plot: "Plot 1" },
  { key: treeNumberOptionKey("1280.1", "Plot 2"), treeNo: "1280.1", plot: "Plot 2" },
  { key: treeNumberOptionKey("386.1", "Plot 1"), treeNo: "386.1", plot: "Plot 1" },
]

assert.deepEqual(
  rankTreeNumberOptions(options, " 1280.1 ").map((option) => option.treeNo),
  ["1280.1"],
)
assert.deepEqual(
  rankTreeNumberOptions(options, "1").map((option) => option.treeNo),
  ["1", "10", "11", "1280.1"],
)
assert.deepEqual(rankTreeNumberOptions(options, "80").map((option) => option.treeNo), [])

const futureDuplicateOptions = [
  { key: treeNumberOptionKey("845.1", "Plot 1"), treeNo: "845.1", plot: "Plot 1" },
  { key: treeNumberOptionKey("845.1", "Plot 2"), treeNo: "845.1", plot: "Plot 2" },
]
assert.equal(rankTreeNumberOptions(futureDuplicateOptions, "845.1").length, 2)
assert.notEqual(futureDuplicateOptions[0].key, futureDuplicateOptions[1].key)

assert.equal(treeNumberSuggestionsUrl(" 386.1 ", 25), "/api/coconut-harvest/trees?q=386.1&limit=25")

const autocomplete = await readFile(
  "components/harvest/tree-number-autocomplete.tsx",
  "utf8",
)
for (const requiredContract of [
  'role="combobox"',
  'aria-autocomplete="list"',
  'role="listbox"',
  'role="option"',
  '"ArrowDown"',
  '"ArrowUp"',
  '"Enter"',
  '"Escape"',
  "Loading tree numbers…",
  "Unable to load Tree Numbers. Retry.",
  "No valid Tree Number found.",
]) {
  assert.ok(autocomplete.includes(requiredContract), `Missing autocomplete contract: ${requiredContract}`)
}

const mapClient = await readFile("components/maps/farm-map-client.tsx", "utf8")
assert.match(mapClient, /treesByKey/)
assert.match(mapClient, /treesByNumber/)
assert.match(mapClient, /treeNumberOptionKey/)
assert.match(mapClient, /treeMasterNumbers\.has/)
assert.match(mapClient, /Select a valid Tree Number from the available list\./)
assert.match(
  mapClient,
  /Tree found in \$\{treePlot\}\. Select \$\{treePlot\} or Plot 1 & Plot 2\./,
)
assert.doesNotMatch(mapClient, /type="number"/)
assert.doesNotMatch(mapClient, /parseFloat|parseInt/)

const treeView = await readFile("components/coconut/tree-view-client.tsx", "utf8")
assert.match(treeView, /treeNumberSuggestionsUrl\(query, 25\)/)
assert.match(treeView, /Show Tree History/)

const treeMasterRoute = await readFile(
  "app/api/coconut-harvest/tree-master/route.ts",
  "utf8",
)
assert.match(treeMasterRoute, /fetchAllTreeNumbers/)
assert.match(treeMasterRoute, /source: "TREE MASTER"/)

console.log("TREE MASTER autocomplete contracts: PASS")
