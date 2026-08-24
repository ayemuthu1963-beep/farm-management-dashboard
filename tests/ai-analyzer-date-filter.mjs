import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  filterAnalyzerAlerts,
  isValidIsoCalendarDate,
  matchesAnalyzerAlertDate,
  resolveVisibleAnalyzerAlert,
} from "../lib/ai-analyzer-filtering.ts"

const allFilters = { crop: "all", plot: "all", zone: "all", date: "", severity: "all" }

function alert(id, start_date, end_date, overrides = {}) {
  return {
    alert_id: id,
    crop: "Coconut",
    plot: "Plot 1",
    zone: "P1E",
    severity: "warning",
    start_date,
    end_date,
    ...overrides,
  }
}

const point = alert("point", "2026-08-25", null)
const range = alert("range", "2026-08-20", "2026-08-25")
const equalRange = alert("equal", "2026-08-25", "2026-08-25")
const undated = alert("undated", null, null, { crop: "Jackfruit", zone: "JF", severity: "information" })

// 1-9: blank, point, inclusive range boundaries/interior, equal range, and undated policy.
assert.equal(matchesAnalyzerAlertDate(point, ""), true)
assert.equal(matchesAnalyzerAlertDate(point, "2026-08-25"), true)
assert.equal(matchesAnalyzerAlertDate(point, "2026-08-24"), false)
assert.equal(matchesAnalyzerAlertDate(range, "2026-08-20"), true)
assert.equal(matchesAnalyzerAlertDate(range, "2026-08-25"), true)
assert.equal(matchesAnalyzerAlertDate(range, "2026-08-23"), true)
assert.equal(matchesAnalyzerAlertDate(range, "2026-08-19"), false)
assert.equal(matchesAnalyzerAlertDate(range, "2026-08-26"), false)
assert.equal(matchesAnalyzerAlertDate(equalRange, "2026-08-25"), true)
assert.equal(matchesAnalyzerAlertDate(undated, "2026-08-25"), false)

// 10-12: malformed/reversed data fails closed, no UTC conversion, and leap-day validation.
for (const invalid of ["2026-02-30", "2026-2-03", "not-a-date", "", "2026-13-01", "0000-01-01"]) {
  assert.equal(isValidIsoCalendarDate(invalid), false, `${invalid || "blank"} must not be treated as a structured date`)
}
assert.equal(matchesAnalyzerAlertDate(alert("bad-start", "2026-02-30", null), "2026-02-28"), false)
assert.equal(matchesAnalyzerAlertDate(alert("bad-end", "2026-02-01", "bad"), "2026-02-01"), false)
assert.equal(matchesAnalyzerAlertDate(alert("end-only", null, "2026-08-25"), "2026-08-25"), false)
assert.equal(matchesAnalyzerAlertDate(alert("reversed", "2026-08-25", "2026-08-20"), "2026-08-23"), false)
assert.equal(matchesAnalyzerAlertDate(alert("kolkata-day", "2026-08-25", null), "2026-08-25"), true)
assert.equal(isValidIsoCalendarDate("2024-02-29"), true)
assert.equal(isValidIsoCalendarDate("2026-02-29"), false)

const fixture = [
  point,
  range,
  equalRange,
  undated,
  alert("other-crop", "2026-08-25", null, { crop: "Nutmeg", zone: "NM", severity: "critical" }),
]

// 13-18: clearing and every required combined-filter shape operate on one canonical input.
assert.equal(filterAnalyzerAlerts(fixture, { ...allFilters, date: "" }).length, fixture.length)
assert.deepEqual(filterAnalyzerAlerts(fixture, { ...allFilters, date: "2026-08-25", crop: "Coconut" }).map(({ alert_id }) => alert_id), ["point", "range", "equal"])
assert.deepEqual(filterAnalyzerAlerts(fixture, { ...allFilters, date: "2026-08-25", zone: "P1E" }).map(({ alert_id }) => alert_id), ["point", "range", "equal"])
assert.deepEqual(filterAnalyzerAlerts(fixture, { ...allFilters, date: "2026-08-25", severity: "critical" }).map(({ alert_id }) => alert_id), ["other-crop"])
assert.deepEqual(filterAnalyzerAlerts(fixture, { ...allFilters, date: "2026-08-25", crop: "Nutmeg", zone: "NM", severity: "critical" }).map(({ alert_id }) => alert_id), ["other-crop"])

// 19-20: ten date/clear cycles neither append nor drift the rendered/count source.
for (let cycle = 0; cycle < 10; cycle += 1) {
  const filtered = filterAnalyzerAlerts(fixture, { ...allFilters, date: "2026-08-25" })
  assert.equal(filtered.length, 4)
  const cleared = filterAnalyzerAlerts(fixture, allFilters)
  assert.equal(cleared.length, fixture.length)
  assert.deepEqual(cleared.map(({ alert_id }) => alert_id), fixture.map(({ alert_id }) => alert_id))
}

// 21: selected evidence always resolves from the visible collection.
const visible = filterAnalyzerAlerts(fixture, { ...allFilters, date: "2026-08-25", crop: "Nutmeg" })
assert.equal(resolveVisibleAnalyzerAlert(visible, "point")?.alert_id, "other-crop")
assert.equal(resolveVisibleAnalyzerAlert([], "point"), null)

// 22: the documented reload/default state is blank and therefore canonical.
assert.equal(allFilters.date, "")
assert.equal(filterAnalyzerAlerts(fixture, allFilters).length, fixture.length)

// Captured 25 August sanitized fixture: four current-day alert families match; undated configuration/stock do not.
const currentDayFixture = [
  alert("irrigation-current", "2026-08-25", "2026-08-25", { crop: null, plot: null, zone: null, severity: "warning" }),
  alert("motor-current", "2026-08-25", "2026-08-25", { crop: null, plot: null, zone: null, severity: "warning" }),
  alert("north-well-current", "2026-08-25", "2026-08-25", { crop: null, plot: null, zone: "North Well", severity: "warning" }),
  alert("south-well-current", "2026-08-25", "2026-08-25", { crop: null, plot: null, zone: "South Well", severity: "warning" }),
  alert("fertiliser-undated", null, null, { crop: null, plot: null, zone: null, severity: "critical" }),
  alert("jackfruit-config", null, null, { crop: "Jackfruit", plot: null, zone: "JF", severity: "information" }),
  alert("nutmeg-config", null, null, { crop: "Nutmeg", plot: null, zone: "NM", severity: "information" }),
]
assert.deepEqual(
  filterAnalyzerAlerts(currentDayFixture, { ...allFilters, date: "2026-08-25" }).map(({ alert_id }) => alert_id),
  ["irrigation-current", "motor-current", "north-well-current", "south-well-current"],
)

// Event and data-write safety guards: native input is captured explicitly; filters have no mutation API.
const clientSource = readFileSync("components/ai-analyzer/ai-analyzer-client.tsx", "utf8")
assert.match(clientSource, /type="date"[^>]*onInput=/)
assert.match(clientSource, /onChange=/)
assert.match(clientSource, /filterAnalyzerAlerts\(data\?\.alerts \?\? \[\], filters\)/)
assert.match(clientSource, /Alerts without a structured date are excluded while Date is active/)
assert.doesNotMatch(clientSource, /new Date\([^)]*filters\.date|Date\.parse\([^)]*filters\.date/)
assert.doesNotMatch(clientSource, /method:\s*["'](?:PUT|PATCH|DELETE)["']/)

console.log("AI Analyzer structured ISO date filtering, selection, count, and no-write invariants: PASS")
