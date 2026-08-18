import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { cropLitresPerTreePerHour, emptyIrrigationData } from "../lib/irrigation-data.ts"
import { buildIrrigationZoneCsv } from "../lib/irrigation-export.ts"
import { buildRecentIrrigationHistory } from "../lib/irrigation-history.ts"
import {
  buildIrrigationPeriodQuery,
  DEFAULT_IRRIGATION_LAST_N_DAYS,
  getIrrigationDateBounds,
  getRecentIrrigationHistoryDates,
  IRRIGATION_LAST_N_DAY_OPTIONS,
  IRRIGATION_PERIOD_OPTIONS,
  resolveIrrigationDateBounds,
} from "../lib/irrigation-period.ts"
import { fetchAllMotorRuntimeEntries } from "../lib/irrigation-upstream.ts"
import {
  IRRIGATION_PLAN_DAYS,
  SCHEDULE_IDS,
  initialMotorRunScheduleRows,
  motorRunSchedulePayload,
} from "../lib/irrigation-plan.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")
const require = createRequire(import.meta.url)
const ts = require("typescript")

function loadTsxModule(relativePath, dependencies) {
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
  }).outputText
  const module = { exports: {} }
  const localRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier]
    throw new Error(`Unexpected dependency while rendering ${relativePath}: ${specifier}`)
  }
  Function("require", "module", "exports", output)(localRequire, module, module.exports)
  return module.exports
}

const jsxRuntime = {
  Fragment: Symbol("Fragment"),
  jsx: (type, props, key) => ({ type, props: props ?? {}, key }),
  jsxs: (type, props, key) => ({ type, props: props ?? {}, key }),
}

function walkElements(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkElements(item, visit)
    return
  }
  if (!value || typeof value !== "object") return
  if (Object.hasOwn(value, "type") && Object.hasOwn(value, "props")) visit(value)
  for (const prop of Object.values(value.props ?? {})) walkElements(prop, visit)
}

function elementText(value) {
  if (Array.isArray(value)) return value.map(elementText).join("")
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (!value || typeof value !== "object") return ""
  return elementText(value.props?.children)
}

const page = read("app/irrigation-management/page.tsx")
const selector = read("components/irrigation/irrigation-period-selector.tsx")
const route = read("app/api/irrigation-management/route.ts")
const map = read("components/irrigation/irrigation-map-with-details.tsx")
const summaryCards = read("components/irrigation/irrigation-summary-cards.tsx")
const zoneStatusCards = read("components/irrigation/zone-status-cards.tsx")
const charts = read("components/irrigation/irrigation-charts-hybrid.tsx")
const comparisonModule = loadTsxModule("lib/irrigation-schedule-comparison.ts", {
  "./irrigation-plan": { IRRIGATION_PLAN_DAYS, SCHEDULE_IDS },
  "./irrigation-data": {},
})
const {
  FARM_TIME_ZONE,
  ZONE_SCHEDULE_IDS,
  compareActualWater,
  farmWeekdayForDate,
  formatActualWater,
  formatLitresPerTree,
  parsePersistedMotorRunScheduleRows,
  scheduledWaterForZoneDate,
} = comparisonModule

// The Farm Irrigation Table compares every zone against the persisted litres
// for its exact stable schedule identifier, independent of row order.
assert.equal(FARM_TIME_ZONE, "Asia/Kolkata")
assert.deepEqual(ZONE_SCHEDULE_IDS, {
  P1W: "schedule-m1-p1w",
  P1E: "schedule-m1-p1e",
  P2W: "schedule-m2-p2w",
  P2E: "schedule-m3-p2e",
  JF: "schedule-m3-jf",
  NM: "schedule-m1-nm",
})
const scheduleRows = initialMotorRunScheduleRows()
const persistedApiRows = motorRunSchedulePayload(scheduleRows).rows.map((row) => ({
  ...row,
  days: Object.fromEntries(Object.entries(row.days).map(([weekday, day]) => [weekday, {
    min: day.min === "" ? null : day.min,
    ltrs: day.ltrs === "" ? null : day.ltrs,
  }])),
}))
const persistedSchedule = parsePersistedMotorRunScheduleRows(persistedApiRows)
assert.deepEqual(persistedSchedule.find((row) => row.scheduleId === "schedule-m1-p1e").days.sun, { min: "", ltrs: "" })
for (const [zoneId, scheduleId] of Object.entries(ZONE_SCHEDULE_IDS)) {
  const expected = persistedSchedule.find((row) => row.scheduleId === scheduleId)
  assert.ok(expected)
  const scheduled = scheduledWaterForZoneDate([...persistedSchedule].reverse(), "ready", zoneId, "2026-08-17")
  const expectedLitres = Number(expected.days.mon.ltrs)
  assert.equal(scheduled.litres, expectedLitres > 0 ? expectedLitres : null)
}

const weekdayCases = [
  ["2026-08-17", "mon"],
  ["2026-08-18", "tue"],
  ["2026-08-19", "wed"],
  ["2026-08-20", "thu"],
  ["2026-08-21", "fri"],
  ["2026-08-22", "sat"],
  ["2026-08-23", "sun"],
]
assert.deepEqual(weekdayCases.map(([date]) => farmWeekdayForDate(date)), weekdayCases.map(([, weekday]) => weekday))
assert.equal(farmWeekdayForDate("2026-08-16"), "sun")
assert.equal(farmWeekdayForDate("invalid"), null)

const sevenDates = getRecentIrrigationHistoryDates("2026-08-17", new Date("2026-08-18T00:00:00Z"))
assert.deepEqual(sevenDates, ["2026-08-17", "2026-08-16", "2026-08-15", "2026-08-14", "2026-08-13", "2026-08-12", "2026-08-11"])
assert.equal(new Set(sevenDates).size, 7)

const p1eWithDistinctMinutes = persistedSchedule.map((row) => row.scheduleId === "schedule-m1-p1e" ? {
  ...row,
  days: { ...row.days, mon: { min: "999", ltrs: "96" } },
} : row)
assert.deepEqual(scheduledWaterForZoneDate(p1eWithDistinctMinutes, "ready", "P1E", "2026-08-17"), {
  kind: "scheduled",
  litres: 96,
  display: "96 L/Tree",
})

const scheduled96 = { kind: "scheduled", litres: 96, display: "96 L/Tree" }
assert.deepEqual([null, 0, 95, 96, 123, 144, 145].map((actual) => compareActualWater(scheduled96, actual).tone), [
  "red", "red", "yellow", "light-green", "light-green", "light-green", "dark-green",
])
assert.equal(compareActualWater(scheduled96, null).status, "scheduled-missing")
assert.equal(compareActualWater(scheduled96, 0).status, "scheduled-missing")
assert.equal(compareActualWater(scheduled96, 123).status, "within-schedule")
assert.equal(compareActualWater(scheduled96, 144).status, "within-schedule")
assert.equal(compareActualWater(scheduled96, 145).status, "above-schedule")

const notScheduled = scheduledWaterForZoneDate(persistedSchedule, "ready", "P1E", "2026-08-23")
assert.deepEqual(notScheduled, { kind: "not-scheduled", litres: null, display: "Not scheduled" })
assert.equal(compareActualWater(notScheduled, null).tone, "neutral")
assert.equal(compareActualWater(notScheduled, 0).tone, "neutral")
assert.equal(compareActualWater(notScheduled, 10).tone, "dark-green")
assert.equal(compareActualWater(notScheduled, 10).explanation, "Water supplied on an unscheduled day")

const unavailable = scheduledWaterForZoneDate([], "unavailable", "P1E", "2026-08-17")
assert.deepEqual(unavailable, { kind: "unavailable", litres: null, display: "Unavailable" })
assert.equal(compareActualWater(unavailable, 123).tone, "neutral")
assert.equal(compareActualWater(unavailable, 123).status, "schedule-unavailable")
assert.equal(formatLitresPerTree(96.5), "96.5 L/Tree")
assert.equal(formatLitresPerTree(96.25), "96.25 L/Tree")
assert.equal(formatActualWater({ perTreeLitres: null }), "No records")
assert.equal(formatActualWater({ perTreeLitres: 0 }), "0 L/Tree")

// Unsaved editor values cannot affect tiles until a successful refetch becomes
// the new persisted source. A failed save leaves the prior projection intact.
const unsavedEditorRows = persistedSchedule.map((row) => row.scheduleId === "schedule-m1-p1e" ? {
  ...row,
  days: { ...row.days, mon: { ...row.days.mon, ltrs: "777" } },
} : row)
assert.equal(scheduledWaterForZoneDate(persistedSchedule, "ready", "P1E", "2026-08-17").litres, 96)
assert.equal(scheduledWaterForZoneDate(unsavedEditorRows, "ready", "P1E", "2026-08-17").litres, 777)
const refetchedRows = parsePersistedMotorRunScheduleRows(motorRunSchedulePayload(unsavedEditorRows).rows)
assert.equal(scheduledWaterForZoneDate(refetchedRows, "ready", "P1E", "2026-08-17").litres, 777)
const failedSaveProjection = persistedSchedule
assert.equal(scheduledWaterForZoneDate(failedSaveProjection, "ready", "P1E", "2026-08-17").litres, 96)

assert.throws(() => parsePersistedMotorRunScheduleRows([]), /six persisted rows/)
assert.throws(() => parsePersistedMotorRunScheduleRows(persistedApiRows.map((row, index) => index === 0 ? { ...row, motor: null } : row)), /invalid persisted cell value/)
assert.throws(() => parsePersistedMotorRunScheduleRows(motorRunSchedulePayload(persistedSchedule).rows.map((row, index) => index === 0 ? { ...row, scheduleId: "invalid" } : row)), /invalid stable schedule identifier/)
assert.throws(() => parsePersistedMotorRunScheduleRows(motorRunSchedulePayload(persistedSchedule).rows.map((row, index) => index === 0 ? { ...row, days: { ...row.days, mon: { ...row.days.mon, ltrs: "invalid" } } } : row)), /invalid mon litres/)

// The existing live-data summary cards appear exactly once after the period
// controls and before Zone Status, without disturbing the approved page order.
assert.equal((page.match(/<IrrigationSummaryCards\b/g) ?? []).length, 1)
assert.match(page, /<IrrigationSummaryCards summary=\{data\.summary\} zoneCount=\{data\.zones\.length\} isLoading=\{isLoading\} \/>/)
const expectedPageSectionTokens = [
  "<IrrigationMapWithDetails",
  "<IrrigationPlanTables",
  "<IrrigationChartsHybrid",
  "<IrrigationPeriodSelector",
  "<IrrigationSummaryCards",
  ">Zone Status</h2>",
  '<Panel title="Operational Alerts"',
  "<IrrigationZoneTableHybrid",
]
const pageSectionOffsets = expectedPageSectionTokens.map((token) => page.indexOf(token))
assert.equal(pageSectionOffsets.every((offset) => offset >= 0), true)
assert.deepEqual(pageSectionOffsets, [...pageSectionOffsets].sort((left, right) => left - right))
assert.match(summaryCards, /grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5/)
for (const label of ["Total Water Pumped", "Total Runtime", "Zones Irrigated", "Zones Not Irrigated", "Avg Water per Tree"]) {
  assert.match(summaryCards, new RegExp(`label="${label}"`))
}
assert.match(summaryCards, /formatWaterLitres\(summary\.totalWaterSupplied\)/)
assert.match(summaryCards, /summary\.totalMotorRuntime/)
assert.match(summaryCards, /summary\.zonesIrrigated/)
assert.match(summaryCards, /summary\.zonesNotIrrigated/)
assert.match(summaryCards, /formatNumberIN\(summary\.averageWaterPerTree\)/)

// The period control exposes exactly the four approved choices.
assert.deepEqual(
  IRRIGATION_PERIOD_OPTIONS.map(({ id, label }) => ({ id, label })),
  [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "lastN", label: "Last N Days" },
    { id: "custom", label: "Custom Date Range" },
  ],
)
assert.equal(DEFAULT_IRRIGATION_LAST_N_DAYS, 7)
assert.deepEqual([...IRRIGATION_LAST_N_DAY_OPTIONS], [2, 3, 4, 5, 6, 7, 8, 9, 10])
assert.doesNotMatch(`${page}\n${selector}\n${route}`, /Current (?:Irrigation )?Cycle/)
assert.doesNotMatch(`${page}\n${selector}\n${route}`, /period=(?:last7|cycle)|"last7"|"cycle"/)
assert.match(selector, /onChange=\{updateLastNDays\}/)
assert.match(selector, /onPeriodChange\(buildIrrigationPeriodQuery\("lastN", days\)\)/)
assert.match(selector, /`Last \$\{lastNDays\} Days`/)
assert.match(selector, /period: "custom", startDate, endDate/)
assert.match(selector, /type="date" required/)

// Execute the selector component with a lightweight JSX runtime so controls and
// immediate Last N interactions are verified without a browser-only test stack.
const stateUpdates = []
const fakeReact = {
  useState(initialValue) {
    const value = typeof initialValue === "function" ? initialValue() : initialValue
    return [value, (nextValue) => stateUpdates.push(nextValue)]
  },
}
const iconStub = "Icon"
const selectorModule = loadTsxModule("components/irrigation/irrigation-period-selector.tsx", {
  react: fakeReact,
  "react/jsx-runtime": jsxRuntime,
  "lucide-react": { CalendarRange: iconStub, Download: iconStub, RefreshCw: iconStub },
  "@/components/farm/panel": { Panel: "Panel" },
  "@/lib/irrigation-period": {
    buildIrrigationPeriodQuery,
    DEFAULT_IRRIGATION_LAST_N_DAYS,
    getIrrigationDateBounds,
    IRRIGATION_LAST_N_DAY_OPTIONS,
    IRRIGATION_PERIOD_OPTIONS,
  },
  "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
})
const periodChanges = []
let exportClicks = 0
const selectorTree = selectorModule.IrrigationPeriodSelector({
  onPeriodChange: (query) => periodChanges.push(query),
  onRefresh: () => {},
  onExport: () => { exportClicks += 1 },
  isLoading: false,
  canExport: true,
})
const selectorElements = []
walkElements(selectorTree, (element) => selectorElements.push(element))
const controlLabels = selectorElements
  .filter((element) => element.type === "button")
  .map((element) => elementText(element))
assert.deepEqual(controlLabels.filter((label) => ["Today", "Yesterday", "Last 7 Days", "Custom Date Range"].includes(label)), [
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Custom Date Range",
])
assert.equal(controlLabels.includes("Current Cycle"), false)
const lastNSelect = selectorElements.find((element) => element.type === "select" && element.props.id === "irrigation-last-n-days")
assert.ok(lastNSelect)
const renderedDayOptions = []
walkElements(lastNSelect, (element) => {
  if (element.type === "option") renderedDayOptions.push(Number(element.props.value))
})
assert.deepEqual(renderedDayOptions, [2, 3, 4, 5, 6, 7, 8, 9, 10])
lastNSelect.props.onChange({ target: { value: "10" } })
assert.equal(new URLSearchParams(periodChanges.at(-1)).get("days"), "10")
const todayButton = selectorElements.find((element) => element.type === "button" && elementText(element) === "Today")
todayButton.props.onClick()
assert.equal(new URLSearchParams(periodChanges.at(-1)).get("period"), "today")
const exportButton = selectorElements.find((element) => element.type === "button" && elementText(element) === "Export to Excel")
exportButton.props.onClick()
assert.equal(exportClicks, 1)

// Preset API queries use calendar boundaries derived in Asia/Kolkata.
const afterIstMidnight = new Date("2026-08-01T19:00:00.000Z") // 02 Aug 2026, 00:30 IST
assert.deepEqual(getIrrigationDateBounds("today", 7, afterIstMidnight), {
  startDate: "2026-08-02",
  endDate: "2026-08-02",
  label: "Today",
})
assert.deepEqual(getIrrigationDateBounds("yesterday", 7, afterIstMidnight), {
  startDate: "2026-08-01",
  endDate: "2026-08-01",
  label: "Yesterday",
})
for (const days of IRRIGATION_LAST_N_DAY_OPTIONS) {
  const query = new URLSearchParams(buildIrrigationPeriodQuery("lastN", days, afterIstMidnight))
  const expectedStart = new Date(Date.UTC(2026, 7, 1 - (days - 1))).toISOString().slice(0, 10)
  assert.equal(query.get("period"), "lastN")
  assert.equal(query.get("days"), String(days))
  assert.equal(query.get("startDate"), expectedStart)
  assert.equal(query.get("endDate"), "2026-08-01")
}
const defaultQuery = new URLSearchParams(buildIrrigationPeriodQuery("lastN", undefined, afterIstMidnight))
assert.equal(defaultQuery.get("days"), "7")
assert.equal(defaultQuery.get("startDate"), "2026-07-26")
assert.equal(defaultQuery.get("endDate"), "2026-08-01")

// The same resolver used by the API route validates and resolves query input.
assert.deepEqual(resolveIrrigationDateBounds(new URLSearchParams("period=lastN&days=10"), afterIstMidnight), {
  startDate: "2026-07-23",
  endDate: "2026-08-01",
  label: "Last 10 Days",
})
assert.deepEqual(resolveIrrigationDateBounds(new URLSearchParams("period=custom&startDate=2026-07-11&endDate=2026-07-19"), afterIstMidnight), {
  startDate: "2026-07-11",
  endDate: "2026-07-19",
  label: "2026-07-11 to 2026-07-19",
})
assert.throws(() => resolveIrrigationDateBounds(new URLSearchParams("period=custom&startDate=2026-07-20&endDate=2026-07-19"), afterIstMidnight), /Start date cannot be after end date/)
assert.throws(() => resolveIrrigationDateBounds(new URLSearchParams("period=cycle"), afterIstMidnight), /Unsupported irrigation period/)
assert.throws(() => resolveIrrigationDateBounds(new URLSearchParams("period=lastN&days=11"), afterIstMidnight), /integer from 2 through 10/)

// Date-filtered pagination is executable: all pages carry exact boundaries and
// an exact 100-row page cannot silently truncate the result.
const upstreamRows = Array.from({ length: 150 }, (_, index) => ({ id: 150 - index, entry_date: "2026-08-01" }))
const upstreamRequests = []
const fetchImpl = async (input) => {
  const url = new URL(String(input))
  upstreamRequests.push(url)
  const offset = Number(url.searchParams.get("offset"))
  const limit = Number(url.searchParams.get("limit"))
  return new Response(JSON.stringify(upstreamRows.slice(offset, offset + limit)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
const fetchedRows = await fetchAllMotorRuntimeEntries({
  baseUrl: "https://preview-api.example.test/",
  startDate: "2026-07-23",
  endDate: "2026-08-01",
  responseLabel: "Motor Runtime API",
  fetchImpl,
})
assert.equal(fetchedRows.length, 150)
assert.deepEqual(upstreamRequests.map((url) => url.searchParams.get("offset")), ["0", "100"])
for (const url of upstreamRequests) {
  assert.equal(url.searchParams.get("start_date"), "2026-07-23")
  assert.equal(url.searchParams.get("end_date"), "2026-08-01")
  assert.equal(url.searchParams.get("limit"), "100")
}
let repeatedPageCalls = 0
await assert.rejects(() => fetchAllMotorRuntimeEntries({
  baseUrl: "https://preview-api.example.test",
  startDate: "2026-07-23",
  endDate: "2026-08-01",
  responseLabel: "Motor Runtime API",
  fetchImpl: async () => {
    repeatedPageCalls += 1
    return new Response(JSON.stringify(upstreamRows.slice(0, 100)), { status: 200 })
  },
}), /pagination did not advance/)
assert.equal(repeatedPageCalls, 2)

// Map history retains the selected-period end-date anchor and expands to seven unique calendar dates.
const historyDates = getRecentIrrigationHistoryDates("2026-07-19", afterIstMidnight)
assert.deepEqual(historyDates, [
  "2026-07-19",
  "2026-07-18",
  "2026-07-17",
  "2026-07-16",
  "2026-07-15",
  "2026-07-14",
  "2026-07-13",
])
assert.equal(new Set(historyDates).size, 7)
assert.match(route, /const historyDates = getRecentIrrigationHistoryDates\(endDate\)/)
assert.match(map, /Seven-day scheduled vs actual/)
assert.doesNotMatch(map, /Five-day water per tree/)

const history = buildRecentIrrigationHistory({
  entries: [
    { entry_date: "2026-07-19", plot: "Plot1_East", total_minutes: 15 },
    { entry_date: "2026-07-19", plot: "Plot1_East", total_minutes: 45 },
    { entry_date: "2026-07-17", plot: "Plot1_West", total_minutes: 30 },
  ],
  historyDates: [...historyDates, "2026-07-19"],
  zoneIds: ["P1E", "P1W"],
  zoneByPlot: new Map([["Plot1_East", "P1E"], ["Plot1_West", "P1W"]]),
  litresPerTreePerHourByZone: { P1E: 100, P1W: 100 },
  today: "2026-08-02",
})
assert.equal(history.P1E.length, 7)
assert.equal(new Set(history.P1E.map(({ date }) => date)).size, 7)
assert.deepEqual(history.P1E[0], {
  date: "2026-07-19",
  displayDate: "19 Jul",
  totalMinutes: 60,
  perTreeLitres: 100,
  status: "Irrigated",
  isCurrentIncompleteDay: false,
})
assert.equal(history.P1E[1].status, "No Record")
assert.equal(history.P1E[1].perTreeLitres, null)

// Zone Status and Farm Irrigation Map preserve the requested visible zone order.
for (const source of [zoneStatusCards, map]) {
  assert.match(source, /const DISPLAY_ZONE_ORDER: ZoneId\[\] = \["P1W", "P1E", "P2W", "P2E", "JF", "NM"\]/)
  assert.match(source, /displayZones\.map\(\(zone\) =>/)
}

// Zone Status uses full zone names, crop-specific icons, and six restrained tile tones.
assert.doesNotMatch(zoneStatusCards, /\{zone\.abbr\}/)
assert.match(zoneStatusCards, /Overlay: Plot 1 East \+ Plot 2 West/)
assert.doesNotMatch(zoneStatusCards, /Overlay: P1E \+ P2W/)
assert.match(zoneStatusCards, />Irrigation Target</)
assert.match(zoneStatusCards, /type="text"/)
assert.match(zoneStatusCards, /placeholder="\*{16}"/)
assert.match(zoneStatusCards, /aria-label=\{`\$\{zone\.name\} irrigation target`\}/)
assert.match(zoneStatusCards, /setIrrigationTargets/)
for (const icon of ["LandPlot", "TreePine", "Leaf"]) {
  assert.match(zoneStatusCards, new RegExp(`\\b${icon}\\b`))
}
for (const tone of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "primary"]) {
  assert.match(zoneStatusCards, new RegExp(`border-${tone}\\/30 bg-${tone}\\/10`))
  assert.match(map, new RegExp(`border-${tone}\\/30 bg-${tone}\\/10`))
}
assert.match(map, /ZONE_TILE_APPEARANCE\[zone\.id\]\.card/)
assert.doesNotMatch(map, /rounded-2xl border bg-card/)
assert.doesNotMatch(map, /Selected Zone Details/)
assert.match(map, /zone\.physicalPlot/)
assert.match(map, /zone\.recordsCount/)

// The full-width map keeps six equal compact tiles on one desktop row. Below
// desktop width, only the map region scrolls horizontally; the page does not.
assert.match(map, /max-w-full overflow-x-auto overscroll-x-contain/)
assert.match(map, /grid min-w-\[96rem\] grid-cols-6 items-stretch gap-2 xl:min-w-0/)
assert.match(map, /aria-label="Farm Irrigation Map zones; scroll horizontally on smaller screens"/)
assert.match(map, /flex h-full min-h-\[330px\] min-w-0 flex-col/)
assert.doesNotMatch(map, /min-h-\[470px\]/)
assert.doesNotMatch(map, /sm:grid-cols-2 xl:grid-cols-3/)

// The requested chart pair is half-width: Daily Irrigation Trend first, then
// Water Supplied per Tree by date with one line for every operational zone.
assert.doesNotMatch(charts, /\bBarChart\b|<Bar\b/)
assert.doesNotMatch(charts, /Runtime and Water Pumped by Zone/)
assert.equal((charts.match(/<Panel title="Daily Irrigation Trend"/g) ?? []).length, 1)
assert.doesNotMatch(charts, /Daily Irrigation Trend" className="lg:col-span-2/)
assert.match(charts, /<ChartState title="Daily Irrigation Trend" label=\{label\} \/>/)
assert.match(charts, /<ChartState title="Water Supplied per Tree" label=\{label\} \/>/)
assert.match(charts, /if \(!hasAnyData\) return <ChartStates label="No live irrigation records for the selected period\." \/>/)
assert.doesNotMatch(charts, /Panel title="Irrigation Charts"/)
const dailyTrendChart = charts.slice(
  charts.indexOf('<Panel title="Daily Irrigation Trend">'),
  charts.indexOf('<Panel title="Water Supplied per Tree">'),
)
assert.match(dailyTrendChart, /<LineChart data=\{trend\}/)
assert.match(dailyTrendChart, /<XAxis dataKey="displayDate"/)
assert.match(dailyTrendChart, /dataKey="totalWaterLitres"/)
assert.match(dailyTrendChart, /dataKey="totalRuntimeHours"/)
const perTreeChart = charts.slice(charts.indexOf('<Panel title="Water Supplied per Tree">'))
assert.match(perTreeChart, /<LineChart data=\{trend\}/)
assert.match(perTreeChart, /<XAxis dataKey="displayDate"/)
assert.match(perTreeChart, /Total water per tree \(L\)/)
for (const zoneId of ["P1E", "P1W", "P2E", "P2W", "JF", "NM"]) {
  assert.match(charts, new RegExp(`key: "${zoneId}"`))
}
assert.deepEqual(cropLitresPerTreePerHour, { Coconut: 100, Nutmeg: 60, Jackfruit: 60 })
assert.match(route, /point\[zoneId\] = cropWaterFigure\(zoneId, minutes\)\.litresPerTree/)
assert.match(route, /point\.totalWaterLitres \+= runtimeWater\(minutes, zoneId\)/)
assert.match(charts, /<Legend content=\{<PerTreeLegend \/>\}/)

const chartModule = loadTsxModule("components/irrigation/irrigation-charts-hybrid.tsx", {
  "react/jsx-runtime": jsxRuntime,
  recharts: Object.fromEntries(["CartesianGrid", "Legend", "Line", "LineChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"].map((name) => [name, name])),
  "@/components/farm/panel": { Panel: "Panel" },
  "@/lib/irrigation-data": { formatNumberIN: (value) => String(value) },
})
const chartTree = chartModule.IrrigationChartsHybrid({
  zones: emptyIrrigationData.zones.map((zone) => ({ ...zone, totalRuntimeMinutes: 60 })),
  trend: [{
    date: "2026-08-01",
    displayDate: "01 Aug",
    totalWaterLitres: 300_000,
    totalRuntimeHours: 6,
    P1E: 100,
    P1W: 100,
    P2E: 100,
    P2W: 100,
    JF: 60,
    NM: 60,
  }],
})
const chartElements = []
walkElements(chartTree, (element) => chartElements.push(element))
assert.equal(chartElements.filter((element) => element.type === "LineChart").length, 2)
assert.equal(chartElements.some((element) => element.type === "BarChart" || element.type === "Bar"), false)
const renderedLines = chartElements.filter((element) => element.type === "Line")
assert.deepEqual(renderedLines.map((element) => element.props.dataKey), [
  "totalWaterLitres",
  "totalRuntimeHours",
  "P1W",
  "P1E",
  "P2W",
  "P2E",
  "JF",
  "NM",
])
assert.deepEqual(renderedLines.slice(2).map((element) => element.props.name), [
  "Plot 1 West",
  "Plot 1 East",
  "Plot 2 West",
  "Plot 2 East",
  "Jackfruit",
  "Nutmeg",
])

// A failed period request cannot leave stale data visible under the newly selected label.
assert.match(page, /setData\(emptyIrrigationData\)/)
assert.equal((page.match(/errorMessage=\{errorMessage\}/g) ?? []).length, 2)

// Export remains wired to a real CSV download and preserves escaping.
const exportData = {
  ...emptyIrrigationData,
  source: "live",
  zones: [{
    ...emptyIrrigationData.zones[0],
    name: 'Plot "Quoted"',
    totalWaterSupplied: 12_500,
    recordsCount: 2,
  }],
}
const csv = buildIrrigationZoneCsv(exportData)
assert.match(csv, /^"Zone","Crop","Motor \/ Valve Mapping"/)
assert.match(csv, /"Plot ""Quoted"""/)
assert.match(csv, /"12500"/)
assert.match(page, /buildIrrigationZoneCsv\(data\)/)
assert.match(page, /link\.click\(\)/)
assert.match(selector, /onClick=\{onExport\}/)
assert.match(selector, /disabled=\{isLoading \|\| !canExport\}/)

console.log("Irrigation Management corrections frontend regression passed")
