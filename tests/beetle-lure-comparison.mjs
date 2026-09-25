import assert from "node:assert/strict"
import { strFromU8, unzipSync } from "fflate"
import { BEETLE_LURE_ASSIGNMENTS } from "../lib/beetle-lure-assignments.ts"
import { BEETLE_LURE_SERIES, buildBeetleLureComparison, comparisonStartDate, lureForTrap, trapLureLabel } from "../lib/beetle-lure-comparison.ts"
import { buildBeetleTrapMatrix } from "../lib/beetle-trap-matrix.ts"
import { buildBeetleTrapMatrixWorkbook } from "../lib/beetle-trap-matrix-excel.ts"
import { buildDailyBeetleCountWorkbook } from "../lib/beetle-daily-count-excel.ts"

// Independently transcribed company-B rows from the supplied 78-trap workbook.
const expectedB = [1,2,5,6,9,10,13,14,17,18,20,22,24,26,29,31,33,34,36,39,40,43,44,47,49,50,52,55,56,58,61,63,64,67,69,70,73,74,77,78]
assert.equal(BEETLE_LURE_ASSIGNMENTS.length, 78)
assert.equal(new Set(BEETLE_LURE_ASSIGNMENTS.map(([trap]) => trap)).size, 78)
for (let trap = 1; trap <= 78; trap++) assert.equal(lureForTrap(String(trap)), expectedB.includes(trap) ? "B" : "G")
assert.equal(lureForTrap("Trap 001"), "B")
assert.equal(lureForTrap("79"), null)
assert.equal(trapLureLabel("Trap 3"), "Trap 3 (G)")
assert.equal(trapLureLabel("99"), "Trap 99 (Unassigned)")
assert.equal(comparisonStartDate("2026-09-01"), "2026-09-24")
assert.equal(comparisonStartDate("2026-10-01"), "2026-10-01")
assert.equal(BEETLE_LURE_SERIES.length, 8)
assert.equal(BEETLE_LURE_SERIES.filter((s) => s.plot === 1).length, 4)
assert.equal(BEETLE_LURE_SERIES.filter((s) => s.plot === 2).length, 4)

const fixture = BEETLE_LURE_ASSIGNMENTS.map(([trap, , species]) => ({
  trap_no: trap, trap_type: species, active: true,
  inspection_records: [
    { inspection_date: "2026-09-23", beetle_count: 999 },
    { inspection_date: "2026-09-24", beetle_count: 1 },
    { inspection_date: "2026-09-25", beetle_count: 0 },
    { inspection_date: "2026-09-26", beetle_count: 888 },
  ],
}))
const original = JSON.stringify(fixture)
const result = buildBeetleLureComparison(fixture, "2026-09-24", "2026-09-25")
assert.equal(JSON.stringify(fixture), original, "Source ODK records must remain untouched")
assert.deepEqual(result.daily.map((row) => row.sourceDate), ["2026-09-25", "2026-09-24"])
assert.deepEqual(result.areas.map((row) => row.area), ["Plot 1 B", "Plot 1 G", "Plot 2 B", "Plot 2 G"])
assert.deepEqual(result.areas.map((row) => [row.red_palm_weevil_traps, row.rhinoceros_beetle_traps]), [[10,9],[10,7],[10,11],[9,12]])
for (const area of result.areas) {
  assert.equal(area.red_palm_weevil_count, area.red_palm_weevil_traps)
  assert.equal(area.rhinoceros_beetle_count, area.rhinoceros_beetle_traps)
  assert.equal(area.average_red_palm_weevil, 1)
  assert.equal(area.average_rhinoceros_beetle, 1)
}
assert.equal(BEETLE_LURE_SERIES.reduce((sum, s) => sum + result.daily[1][s.key], 0), 78)
assert.ok(BEETLE_LURE_SERIES.every((s) => result.daily[0][s.key] === 0), "Recorded zero dates must not be omitted")
const matrix = buildBeetleTrapMatrix(result.locations, result.daily.map((row) => row.sourceDate))
assert.equal(matrix.traps.reduce((sum, trap) => sum + trap.total, 0), 78)
assert.deepEqual(matrix.traps.map((trap) => trap.company), Array.from({length:78},(_,i) => expectedB.includes(i+1)?"B":"G"))

const partial = fixture.map((row) => ({ ...row, inspection_records: [] }))
partial[0].inspection_records = [{ inspection_date: "2026-09-24", beetle_count: 2 }, { inspection_date: "2026-09-24", beetle_count: 3 }]
const sparse = buildBeetleLureComparison(partial)
assert.equal(sparse.daily[0].plot1BRedPalmWeevil, 5)
assert.equal(sparse.daily[0].plot1GRedPalmWeevil, null, "Missing data must not become a zero")
assert.equal(sparse.areas[0].average_red_palm_weevil, 0.5)
assert.equal(sparse.areas[1].red_palm_weevil_count, null)
assert.equal(buildBeetleLureComparison(partial, "2026-10-01").daily.length, 0)
assert.throws(() => buildBeetleLureComparison(fixture.slice(1)), /78/)
assert.throws(() => buildBeetleLureComparison([...fixture, fixture[0]]), /Duplicate/)
assert.throws(() => buildBeetleLureComparison([...fixture, { trap_no: "99", trap_type: "Red Palm Weevil", inspection_records: [] }]), /assignment/)
assert.throws(() => buildBeetleLureComparison([{ ...fixture[0], trap_type: "Rhinoceros Beetle" }, ...fixture.slice(1)]), /species/)
assert.throws(() => buildBeetleLureComparison([{ ...fixture[0], inspection_records: null }, ...fixture.slice(1)]), /unavailable/)
assert.throws(() => buildBeetleLureComparison([{ ...fixture[0], inspection_records: [{ inspection_date: "2026-09-24", beetle_count: -1 }] }, ...fixture.slice(1)]), /invalid/)

async function sheet(blob) {
  return strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))["xl/worksheets/sheet1.xml"])
}
const dailySheet = await sheet(buildDailyBeetleCountWorkbook({ rows: result.daily, startDate: "2026-09-24" }))
for (const series of BEETLE_LURE_SERIES) assert.ok(dailySheet.includes(`Plot ${series.plot} ${series.company} — ${series.species} Count`))
assert.ok(dailySheet.includes('<v>0</v>'))
assert.ok(!dailySheet.includes('<v>999</v>'))
const trapSheet = await sheet(buildBeetleTrapMatrixWorkbook(matrix))
assert.ok(trapSheet.indexOf('Trap No.') < trapSheet.indexOf('B/G'))
assert.ok(trapSheet.indexOf('B/G') < trapSheet.indexOf('Total'))
assert.ok(trapSheet.includes('ySplit="5" topLeftCell="B6"'))
assert.equal((trapSheet.match(/>B<\/t>/g) ?? []).length, 40)
assert.equal((trapSheet.match(/>G<\/t>/g) ?? []).length, 38)
console.log("PASS: 78 Excel assignments; eight series; period boundaries; totals/averages; zeros/gaps; mapping failures; both Excel exports.")
