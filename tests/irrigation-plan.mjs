import assert from "node:assert/strict"
import fs from "node:fs"

import {
  IRRIGATION_PLAN_DAYS,
  calculatedLphPerTree,
  calculatedMeasuredLph,
  dripOutputPayload,
  dripOutputValidationMessages,
  formatIrrigationPlanNumber,
  initialDripOutputRows,
  initialMotorRunScheduleRows,
  motorRunSchedulePayload,
  parseDripOutputRows,
  parseMotorRunScheduleRows,
} from "../lib/irrigation-plan.ts"

const read = (path) => fs.readFileSync(path, "utf8")
const page = read("app/irrigation-management/page.tsx")
const plan = read("components/irrigation/irrigation-plan-tables.tsx")
const map = read("components/irrigation/irrigation-map-with-details.tsx")
const proxy = read("app/api/operator-settings/[[...path]]/route.ts")

const dripRows = initialDripOutputRows()
assert.deepEqual(dripRows.map((row) => row.zoneId), ["zone-p2e", "zone-p2w", "zone-p1e", "zone-p1w", "zone-nm", "zone-jf"])
assert.deepEqual(dripRows.map((row) => row.zone), ["P2E", "P2W", "P1E", "P1W", "NM", "JF"])
assert.deepEqual(
  dripRows.map((row) => [row.designedLph, row.designedSecondsPer100ml, row.measuredSecondsPer100ml, row.dripsPerTree]),
  [
    ["4", "90", "90", "24"],
    ["4", "90", "90", "24"],
    ["4", "90", "90", "24"],
    ["4", "90", "90", "24"],
    ["4", "90", "150", "20"],
    ["4", "90", "90", "16"],
  ],
)
assert.equal(formatIrrigationPlanNumber(calculatedMeasuredLph(dripRows[0])), "4")
assert.equal(formatIrrigationPlanNumber(calculatedLphPerTree(dripRows[0])), "96")
assert.equal(formatIrrigationPlanNumber(calculatedMeasuredLph(dripRows[4])), "2.4")
assert.equal(formatIrrigationPlanNumber(calculatedLphPerTree(dripRows[4])), "48")

const editedDripRows = dripRows.map((row) => row.zoneId === "zone-p2e" ? { ...row, measuredSecondsPer100ml: "120" } : row)
assert.equal(formatIrrigationPlanNumber(calculatedMeasuredLph(editedDripRows[0])), "3")
assert.equal(formatIrrigationPlanNumber(calculatedLphPerTree(editedDripRows[0])), "72")
assert.deepEqual(dripOutputValidationMessages(editedDripRows), [])
const reloadedDripRows = parseDripOutputRows(dripOutputPayload(editedDripRows).rows)
assert.equal(reloadedDripRows[0].zoneId, "zone-p2e")
assert.equal(reloadedDripRows[0].measuredSecondsPer100ml, "120")
assert.equal(formatIrrigationPlanNumber(calculatedLphPerTree(reloadedDripRows[0])), "72")

for (const invalid of ["", "0", "invalid", "Infinity"]) {
  const invalidRows = dripRows.map((row, index) => index === 0 ? { ...row, measuredSecondsPer100ml: invalid } : row)
  assert.equal(formatIrrigationPlanNumber(calculatedMeasuredLph(invalidRows[0])), "—")
  assert.ok(dripOutputValidationMessages(invalidRows).some((message) => message.includes("Measured Sec/100 ml must be greater than zero")))
}

assert.deepEqual(IRRIGATION_PLAN_DAYS.map((day) => day.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
const scheduleRows = initialMotorRunScheduleRows()
assert.equal(scheduleRows.length, 6)
assert.deepEqual(scheduleRows.map((row) => row.scheduleId), ["schedule-m1-p1e", "schedule-m1-p1w", "schedule-m1-nm", "schedule-m2-p2w", "schedule-m3-p2e", "schedule-m3-jf"])
for (const row of scheduleRows) assert.deepEqual(row.days.sun, { min: "", ltrs: "" })
for (const plot of ["P2W", "P2E"]) {
  const row = scheduleRows.find((candidate) => candidate.plot === plot)
  assert.ok(row)
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat"]) {
    assert.deepEqual(row.days[day], { min: "30×3", ltrs: "144" })
  }
}
const editedSchedule = scheduleRows.map((row) => row.plot === "JF" ? { ...row, days: { ...row.days, sun: { min: "15", ltrs: "16" } } } : row)
const reloadedSchedule = parseMotorRunScheduleRows(motorRunSchedulePayload(editedSchedule).rows)
assert.equal(reloadedSchedule.find((row) => row.plot === "JF").scheduleId, "schedule-m3-jf")
assert.deepEqual(reloadedSchedule.find((row) => row.plot === "JF").days.sun, { min: "15", ltrs: "16" })

assert.match(plan, /title="Drip Output"/)
assert.match(plan, /title="Motor Run Schedule"/)
assert.doesNotMatch(plan, />Tus</)
assert.match(plan, /lg:grid-cols-\[minmax\(0,0\.95fr\)_minmax\(0,1\.8fr\)\]/)
assert.match(plan, /max-w-full overflow-x-auto/)
assert.match(plan, /whitespace-nowrap/)
assert.match(plan, /beforeunload/)
assert.match(plan, /dripSaving\.current/)
assert.match(plan, /scheduleSaving\.current/)
assert.match(plan, /!dirty/)
assert.match(plan, /Saved successfully/)
assert.match(plan, /Unsaved changes/)
assert.match(plan, /irrigation-plan\/drip-output/)
assert.match(plan, /irrigation-plan\/motor-run-schedule/)
assert.match(page, /fetch\("\/api\/operator-settings\/irrigation-plan\/motor-run-schedule", \{ cache: "no-store" \}\)/)
assert.doesNotMatch(map, /\bfetch\(/)
assert.match(plan, /saveAccepted = true/)
assert.match(plan, /const persistedResponse = await fetch\("\/api\/operator-settings\/irrigation-plan\/motor-run-schedule", \{ cache: "no-store" \}\)/)
assert.match(plan, /onPersistedScheduleChange\(savedRows\)/)
assert.match(plan, /if \(saveAccepted\) onPersistedScheduleUnavailable\(message\)/)
assert.match(page, /persistedScheduleRows=\{persistedScheduleRows\}/)
assert.match(map, /data-water-status=\{comparison\.status\}/)
assert.match(map, /Date<\/span>/)
assert.match(map, /Scheduled<\/span>/)
assert.match(map, /Actual<\/span>/)
assert.match(map, /grid-cols-\[2\.3rem_minmax\(0,1fr\)_minmax\(0,1fr\)\]/)
assert.match(map, /ACTUAL_TONE_CLASSES\[comparison\.tone\]/)
assert.match(map, /Motor Run Schedule is unavailable/)
assert.match(map, /actual irrigation data is unchanged/)
assert.match(proxy, /irrigation-plan\\\/\(drip-output\|motor-run-schedule\)/)
assert.match(proxy, /getAuthenticatedUserAssertionHeaders/)
assert.doesNotMatch(proxy, /signActorAssertion/)

assert.doesNotMatch(map, /Selected Zone Details/)
assert.match(map, /^\s*<Panel title="Farm Irrigation Table"/m)
for (const retained of ["physicalPlot", "valveOpenTime", "totalWaterSupplied", "waterPerTree", "recordsCount", "configuredMotorValves", "fiveDayHistory"]) {
  assert.match(map, new RegExp(`zone\\.${retained}`))
}

const order = [
  "<IrrigationMapWithDetails",
  "<IrrigationPlanTables",
  "<IrrigationChartsHybrid",
  "<IrrigationPeriodSelector",
  "<ZoneStatusCards",
  '<Panel title="Operational Alerts"',
  "<IrrigationZoneTableHybrid",
].map((needle) => page.indexOf(needle))
assert.ok(order.every((index) => index >= 0))
assert.deepEqual([...order].sort((left, right) => left - right), order)

console.log("Irrigation Plan calculations, Sunday, editing, save, reload, and layout tests passed")
