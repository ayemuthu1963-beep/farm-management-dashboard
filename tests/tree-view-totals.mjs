import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { calculateTreeHarvestTotals } from "../lib/tree-harvest-totals.ts"

const testDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(testDir, "..")
const treeViewSource = fs.readFileSync(
  path.join(rootDir, "components", "coconut", "tree-view-client.tsx"),
  "utf8",
)

const tree123Rows = [
  [25, 0, 0, 1, 25, 0],
  [29, 20, 0, 2, 49, 1700.16],
  [10, 9, 0, 2, 19, 728.08],
  [15, 8, 0, 2, 23, 828.19],
  [29, 34, 25, 3, 88, 2146.12],
  [41, 50, 51, 3, 142, 2011.81],
  [0, 0, 0, 0, 0, 0],
  [22, 0, 0, 1, 22, 494.78],
  [29, 21, 0, 2, 50, 1496.61],
  [21, 0, 0, 1, 21, 762.66],
  [0, 0, 0, 0, 0, 0],
  [17, 20, 0, 2, 37, 1187.77],
  [11, 0, 0, 1, 11, 424.6],
  [0, 0, 0, 0, 0, 0],
  [29, 0, 0, 1, 29, 707.02],
  [36, 43, 0, 2, 79, 1119.1],
  [46, 0, 0, 1, 46, 672.04],
  [49, 0, 0, 1, 49, 1102.01],
  [0, 0, 0, 0, 0, 0],
].map(([nutsB1, nutsB2, nutsB3, totalBunches, totalNuts, totalSale]) => ({
  nutsB1,
  nutsB2,
  nutsB3,
  totalBunches,
  totalNuts,
  totalSale,
}))

const tree123Totals = calculateTreeHarvestTotals(tree123Rows)
assert.deepEqual(
  {
    nutsB1: tree123Totals.nutsB1,
    nutsB2: tree123Totals.nutsB2,
    nutsB3: tree123Totals.nutsB3,
    totalBunches: tree123Totals.totalBunches,
    totalNuts: tree123Totals.totalNuts,
    totalSale: tree123Totals.totalSale,
  },
  { nutsB1: 409, nutsB2: 205, nutsB3: 76, totalBunches: 25, totalNuts: 690, totalSale: 15382 },
  "Tree 123 totals must match the approved workbook",
)

assert.deepEqual(
  calculateTreeHarvestTotals([]),
  { nutsB1: 0, nutsB2: 0, nutsB3: 0, totalBunches: 0, totalNuts: 0, totalSale: 0 },
  "empty results must display zero totals",
)

const filteredTotals = calculateTreeHarvestTotals([
  tree123Rows[0],
  tree123Rows[1],
  { nutsB1: null, nutsB2: null, nutsB3: null, totalBunches: null, totalNuts: null, totalSale: null },
])
assert.deepEqual(
  filteredTotals,
  { nutsB1: 54, nutsB2: 20, nutsB3: 0, totalBunches: 3, totalNuts: 74, totalSale: 1700 },
  "filtered totals must use all matching rows and treat null numeric values as zero",
)

const headers = [
  "Tree No",
  "Cycle",
  "Harvest Date",
  "Nuts Bunch : 1",
  "Nuts Bunch : 2",
  "Nuts Bunch : 3",
  "Total Bunches",
  "Total Nuts",
  "Total Sale",
]
let previousHeaderIndex = -1
for (const header of headers) {
  const headerIndex = treeViewSource.indexOf(`>${header}</th>`)
  assert.ok(headerIndex > previousHeaderIndex, `${header} must appear in the approved column order`)
  previousHeaderIndex = headerIndex
}
assert.ok(!treeViewSource.includes(">Nuts-B1</th>"), "legacy Nuts-B1 header must be removed")
assert.ok(!treeViewSource.includes(">Total-B</th>"), "legacy Total-B header must be removed")

const tableHeadIndex = treeViewSource.indexOf("<thead>")
const totalsRowIndex = treeViewSource.indexOf('data-testid="tree-history-totals-row"')
const recordsBodyIndex = treeViewSource.indexOf('data-testid="tree-history-records"')
const recordsMapIndex = treeViewSource.indexOf("treeHistory.map((r)")
assert.ok(
  tableHeadIndex >= 0 && tableHeadIndex < totalsRowIndex && totalsRowIndex < recordsBodyIndex && recordsBodyIndex < recordsMapIndex,
  "the totals row must remain directly after the header and outside the sortable records body",
)
assert.match(
  treeViewSource.slice(totalsRowIndex, recordsBodyIndex),
  /font-bold text-destructive/,
  "the complete totals row must be bold and red",
)
assert.match(treeViewSource, /treeHistory\.length === 0[\s\S]*No harvest records found/, "empty results must retain the totals table")
assert.match(
  treeViewSource,
  /const \[showPerformance, setShowPerformance\] = useState\(true\)/,
  "Tree Performance must be visible by default",
)
assert.match(treeViewSource, /Hide Tree Performance/, "the visible performance section must retain its Hide button")

console.log("tree-view totals tests passed")
