import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Import functions directly from calculations.ts (its only ./types import is type-only and
// stripped at runtime), avoiding the barrel's extensionless runtime re-export chain.
import { formatDisplayDate, getWeekEnd, getWeekStart, shiftWeek } from "../lib/worker-management/calculations.ts"

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

// Assert the seeded week constants from source (mirrors the navigation-consistency test style).
const wageEntriesSource = readFileSync(join(repoRoot, "lib/worker-management/wage-entries.ts"), "utf8")
assert.match(
  wageEntriesSource,
  /CURRENT_WEEK_START\s*=\s*"2026-08-08"/,
  "CURRENT_WEEK_START must be Saturday 08 Aug 2026",
)
assert.match(
  wageEntriesSource,
  /PREVIOUS_WEEK_START\s*=\s*"2026-08-01"/,
  "PREVIOUS_WEEK_START must be Saturday 01 Aug 2026",
)

// The sample current farm week is Saturday 08 Aug 2026 – Friday 14 Aug 2026.
const CURRENT_WEEK_START = "2026-08-08"
const PREVIOUS_WEEK_START = "2026-08-01"
const SATURDAY = "2026-08-08"
const SUNDAY = "2026-08-09"
const MONDAY = "2026-08-10"
const FRIDAY = "2026-08-14"

// Sanity: 08 Aug 2026 must genuinely be a Saturday in UTC.
assert.equal(new Date(`${SATURDAY}T00:00:00.000Z`).getUTCDay(), 6, "08 Aug 2026 must be a Saturday (UTC)")

// getWeekStart must snap every day of the farm week back to the Saturday start.
assert.equal(getWeekStart(SATURDAY), SATURDAY, "Saturday snaps to itself")
assert.equal(getWeekStart(SUNDAY), SATURDAY, "Sunday snaps back to Saturday")
assert.equal(getWeekStart(MONDAY), SATURDAY, "Monday snaps back to Saturday")
assert.equal(getWeekStart(FRIDAY), SATURDAY, "Friday snaps back to the same week's Saturday")

// The Friday BEFORE the current week must belong to the previous week (01–07 Aug).
assert.equal(getWeekStart("2026-08-07"), PREVIOUS_WEEK_START, "07 Aug belongs to the previous farm week")

// getWeekEnd must be the inclusive Friday six days after the Saturday start.
for (const day of [SATURDAY, SUNDAY, MONDAY, FRIDAY]) {
  assert.equal(getWeekEnd(day), FRIDAY, `getWeekEnd(${day}) must be Friday ${FRIDAY}`)
}
assert.equal(getWeekEnd("2026-08-07"), "2026-08-07", "Previous week ends Friday 07 Aug")

// Constants must reflect the Saturday–Friday convention.
assert.equal(CURRENT_WEEK_START, SATURDAY, "CURRENT_WEEK_START must be Saturday 08 Aug 2026")
assert.equal(PREVIOUS_WEEK_START, "2026-08-01", "PREVIOUS_WEEK_START must be Saturday 01 Aug 2026")
assert.equal(getWeekStart(CURRENT_WEEK_START), CURRENT_WEEK_START)
assert.equal(getWeekEnd(CURRENT_WEEK_START), FRIDAY)

// Recent-week enumeration must be newest → oldest, each a valid Saturday–Friday range.
const enumeration = Array.from({ length: 4 }, (_, index) => {
  const weekStart = shiftWeek(CURRENT_WEEK_START, -index)
  return `${formatDisplayDate(weekStart)} – ${formatDisplayDate(getWeekEnd(weekStart))}`
})
assert.deepEqual(
  enumeration,
  [
    "08 Aug 2026 – 14 Aug 2026",
    "01 Aug 2026 – 07 Aug 2026",
    "25 Jul 2026 – 31 Jul 2026",
    "18 Jul 2026 – 24 Jul 2026",
  ],
  "Week options must enumerate newest → oldest with inclusive Saturday–Friday labels",
)

// Each enumerated range start must be a Saturday and end a Friday, start strictly before end.
for (const index of [0, 1, 2, 3]) {
  const weekStart = shiftWeek(CURRENT_WEEK_START, -index)
  const weekEnd = getWeekEnd(weekStart)
  assert.equal(new Date(`${weekStart}T00:00:00.000Z`).getUTCDay(), 6, `range ${index} must start on Saturday`)
  assert.equal(new Date(`${weekEnd}T00:00:00.000Z`).getUTCDay(), 5, `range ${index} must end on Friday`)
  assert.ok(weekStart < weekEnd, `range ${index} start must be before end (no reversed labels)`)
}

console.log("Worker Management farm-week (Sat–Fri) start/end, enumeration and labels: PASS")
