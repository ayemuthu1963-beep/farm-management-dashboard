import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  authenticatedUserCanonicalString,
  actorCanonicalString,
  resolveWorkerActor,
  sha256Hex,
  signAuthenticatedUserAssertion,
  signActorAssertion,
  WorkerBffError,
} from "../lib/worker-management-signing.ts"
import {
  buildWageWeeks,
  calculateDailyWage,
  compareAccountCodes,
  defaultSettlementDate,
  normaliseWeeklyWageEntry,
  workerAccountOptionLabel,
} from "../lib/worker-management-format.ts"
import { friendlyWorkerErrorMessage } from "../lib/worker-management-api.ts"
import {
  approvedWorkerRoster,
  compareApprovedWorkerRoster,
} from "../lib/worker-management-roster.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(join(root, path), "utf8")

let assertions = 0
const check = (condition, message) => {
  assert.ok(condition, message)
  assertions += 1
}

const expectedApprovedRoster = [
  "Kuppan",
  "Arunan",
  "Sivan",
  "Lokesh",
  "Tiruma",
  "Rani",
  "Mary",
  "Raja Mani",
  "Chitra",
  "Vijaya",
  "Outside Ladies",
]
assert.deepEqual(
  approvedWorkerRoster.map((worker) => worker.name),
  expectedApprovedRoster,
  "The approved Worker Management roster must use the requested display order",
)
assert.equal(new Set(approvedWorkerRoster.map((worker) => worker.accountCode)).size, expectedApprovedRoster.length)
assert.equal(new Set(approvedWorkerRoster.map((worker) => worker.name)).size, expectedApprovedRoster.length)
assert.deepEqual(
  approvedWorkerRoster
    .map((worker) => ({ account_code: worker.accountCode, display_name: worker.name }))
    .toReversed()
    .toSorted(compareApprovedWorkerRoster)
    .map((worker) => worker.display_name),
  expectedApprovedRoster,
  "Roster sorting must be driven by stable account codes without duplicates or omissions",
)
assert.deepEqual(
  ["WG-CUSTOM-10", "WG-CUSTOM-2", "WG-CUSTOM-1"]
    .map((account_code) => ({ account_code }))
    .toSorted(compareApprovedWorkerRoster)
    .map((worker) => worker.account_code),
  ["WG-CUSTOM-1", "WG-CUSTOM-2", "WG-CUSTOM-10"],
  "Non-roster group entries must use stable natural account-code order",
)
assertions += 5

assert.equal(defaultSettlementDate(new Date("2026-08-08T06:00:00Z")), "2026-08-07")
assert.equal(defaultSettlementDate(new Date("2026-08-10T06:00:00Z")), "2026-08-10")
assertions += 2

const augustWeeks = buildWageWeeks("2026-08-25")
assert.equal(augustWeeks.current.startDate, "2026-08-22")
assert.equal(augustWeeks.current.endDate, "2026-08-28")
assert.equal(augustWeeks.current.label, "22–28 Aug 2026 · current week")
assert.equal(augustWeeks.previous.startDate, "2026-08-15")
assert.equal(augustWeeks.previous.endDate, "2026-08-21")
assert.equal(augustWeeks.previous.label, "15–21 Aug 2026 · last week")
assert.deepEqual(augustWeeks.current.days.map((day) => day.isoDate), [
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
  "2026-08-25",
  "2026-08-26",
  "2026-08-27",
  "2026-08-28",
])
assert.equal(buildWageWeeks("2026-09-01").current.heading, "29 Aug – 4 Sep 2026")
assert.equal(buildWageWeeks("2026-01-01").current.heading, "27 Dec 2025 – 2 Jan 2026")
assert.equal(
  friendlyWorkerErrorMessage("group_attendee_count must be a whole number."),
  "Enter the number of labourers as a whole number (for example 4).",
)
assertions += 10

for (const [rate, expectedTwoThirds, expectedOneThird] of [
  [400, 266, 133],
  [350, 233, 116],
  [300, 200, 100],
]) {
  assert.equal(calculateDailyWage(rate, "TWO_THIRDS", null, "FARM"), expectedTwoThirds)
  assert.equal(calculateDailyWage(rate, "ONE_THIRD", null, "FARM"), expectedOneThird)
  assertions += 2
}

assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "FARM", farmScheme: "THREE_OPTION", dailyWage: "", labourers: "", baseWage: 400 }),
  { attendance: "ABSENT", groupAttendeeCount: null, wageRateSnapshot: 400 },
  "A blank individual wage must save as zero attendance with a valid rate snapshot",
)
assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "GROUP", farmScheme: null, dailyWage: "", labourers: "", baseWage: 320 }),
  { attendance: null, groupAttendeeCount: 0, wageRateSnapshot: 320 },
  "Blank group cells must save a numeric zero labour count",
)
assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "GROUP", farmScheme: null, dailyWage: 160, labourers: 3, baseWage: 320 }),
  { attendance: null, groupAttendeeCount: 3, wageRateSnapshot: 160 },
  "Entered group counts and wage overrides must remain unchanged",
)
assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "FARM", farmScheme: "THREE_OPTION", dailyWage: 266, labourers: "", baseWage: 400 }),
  { attendance: "TWO_THIRDS", groupAttendeeCount: null, wageRateSnapshot: 400 },
  "A supported two-thirds wage must preserve the base-rate snapshot and attendance fraction",
)
assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "FARM", farmScheme: "THREE_OPTION", dailyWage: 133, labourers: "", baseWage: 400 }),
  { attendance: "ONE_THIRD", groupAttendeeCount: null, wageRateSnapshot: 400 },
  "A supported one-third wage must preserve the base-rate snapshot and attendance fraction",
)
assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "FARM", farmScheme: "TWO_OPTION", dailyWage: 150, labourers: "", baseWage: 300 }),
  { attendance: "HALF", groupAttendeeCount: null, wageRateSnapshot: 300 },
  "A supported half wage must preserve the base-rate snapshot and attendance fraction",
)
assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "FARM", farmScheme: "THREE_OPTION", dailyWage: 275, labourers: "", baseWage: 400 }),
  { attendance: "FULL", groupAttendeeCount: null, wageRateSnapshot: 275 },
  "A non-standard positive wage must remain an explicit full-day rate override",
)
assert.deepEqual(
  normaliseWeeklyWageEntry({ accountType: "OUTSIDE", farmScheme: null, dailyWage: 160, labourers: "", baseWage: 320 }),
  { attendance: "FULL", groupAttendeeCount: null, wageRateSnapshot: 160 },
  "Outside Workers must retain their full-day operator rate",
)
assertions += 8

const naturallySortedAccounts = [
  { account_id: 10, account_code: "FW-10", display_name: "Ten" },
  { account_id: 2, account_code: "FW-2", display_name: "Two" },
  { account_id: 1, account_code: "FW-001", display_name: "One" },
].toSorted(compareAccountCodes)
assert.deepEqual(
  naturallySortedAccounts.map((account) => account.account_code),
  ["FW-001", "FW-2", "FW-10"],
)
assert.equal(workerAccountOptionLabel(naturallySortedAccounts[0]), "FW-001 · One")
assertions += 2

const body = '{"weekly_payment":"500.00"}'
const bodySha256 = sha256Hex(body)
assert.equal(bodySha256, "2c904ae5ea860e4361446cf93a99b827ed52936a71ceefde4d43e18b17f86258")
assertions += 1

const authenticatedUserInput = {
  timestamp: "1786329000",
  method: "get",
  target: "/api/worker-management/accounts?is_active=true",
  username: "muthu",
}
assert.equal(
  authenticatedUserCanonicalString(authenticatedUserInput),
  [
    "1786329000",
    "GET",
    "/api/worker-management/accounts?is_active=true",
    "muthu",
  ].join("\n"),
)
assert.equal(
  signAuthenticatedUserAssertion("service-secret", authenticatedUserInput),
  "9e61bc8ba7553d4f256f56ddea430e92f5941cc5f2f4b1bfe13ac961f6434023",
)
assertions += 2

const signingInput = {
  timestamp: "1786329000",
  method: "patch",
  target: "/api/worker-management/weeks/7/settlements/3?source=ui",
  bodySha256,
  username: "muthu",
  role: "admin",
  environment: "preview",
}
assert.equal(
  actorCanonicalString(signingInput),
  [
    "1786329000",
    "PATCH",
    "/api/worker-management/weeks/7/settlements/3?source=ui",
    bodySha256,
    "muthu",
    "admin",
    "preview",
  ].join("\n"),
)
assertions += 1
assert.equal(
  signActorAssertion("worker-test-actor-secret-value-1234567890", signingInput),
  "cc08bfca1e03d1dfc0eac3ff888e8dbb0f626b8daf387c9ec2641871ba8e9d67",
)
assertions += 1

assert.deepEqual(
  resolveWorkerActor(new Headers(), {
    MFMS_ENV: "local",
    MFMS_WORKER_LOCAL_ACTOR_ENABLED: "true",
    MFMS_WORKER_LOCAL_ACTOR_USERNAME: "local-admin",
    MFMS_WORKER_LOCAL_ACTOR_ROLE: "admin",
  }),
  { username: "local-admin", role: "admin", environment: "local" },
)
assertions += 1

assert.throws(
  () => resolveWorkerActor(new Headers(), { MFMS_ENV: "local" }),
  (error) => error instanceof WorkerBffError && error.status === 401,
)
assertions += 1

assert.throws(
  () =>
    resolveWorkerActor(
      new Headers({
        "X-MFMS-User": "preview-admin",
        "X-MFMS-Role": "admin",
        "X-MFMS-Environment": "preview",
      }),
      { MFMS_ENV: "preview" },
    ),
  (error) => error instanceof WorkerBffError && error.status === 503,
)
assertions += 1

assert.deepEqual(
  resolveWorkerActor(
    new Headers({
      "X-MFMS-User": "preview-admin",
      "X-MFMS-Role": "viewer",
      "X-MFMS-Environment": "production",
      "X-MFMS-Authenticated-User": "spoofed-browser-user",
    }),
    {
      MFMS_ENV: "preview",
      MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
      MFMS_WORKER_PROXY_DEFAULT_ROLE: "admin",
    },
  ),
  { username: "preview-admin", role: "admin", environment: "preview" },
)
assertions += 1

assert.throws(
  () =>
    resolveWorkerActor(
      new Headers({ "X-MFMS-User": "preview-admin" }),
      { MFMS_ENV: "preview", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" },
    ),
  (error) => error instanceof WorkerBffError && error.status === 503,
)
assertions += 1

assert.throws(
  () => signActorAssertion("short", signingInput),
  (error) => error instanceof WorkerBffError && error.status === 503,
)
assertions += 1

const routeFiles = [
  "app/worker-management/page.tsx",
  "app/worker-management/daily-attendance/page.tsx",
  "app/worker-management/workers/page.tsx",
  "app/worker-management/weekly-settlement/page.tsx",
  "app/worker-management/loan-register/page.tsx",
  "app/worker-management/dashboard/page.tsx",
  "app/worker-management/query/page.tsx",
  "app/api/worker-management/[[...path]]/route.ts",
]
for (const route of routeFiles) check(existsSync(join(root, route)), `Missing Worker route: ${route}`)

const moduleShell = read("components/worker-management/worker-module-shell.tsx")
const expectedOrder = [
  'label: "Weekly Wage Table"',
  'label: "Daily Attendance"',
  'label: "Worker Management"',
  'label: "Weekly Settlement"',
  'label: "Loan Register"',
  'label: "Dashboard"',
  'label: "Query"',
]
let previousIndex = -1
for (const label of expectedOrder) {
  const index = moduleShell.indexOf(label)
  check(index > previousIndex, `Worker module navigation is out of order at ${label}`)
  previousIndex = index
}

const mfmsNavigation = read("lib/mfms-navigation.ts")
check(/id: "worker-management"[\s\S]*?href: "\/worker-management"[\s\S]*?status: "active"/.test(mfmsNavigation), "Global Worker navigation is not active")

const workerManagementPage = read("app/worker-management/page.tsx")
const weeklyWagePreview = read("components/worker-management/weekly-wage-table-preview.tsx")
check(workerManagementPage.includes("WeeklyWageTablePreview"), "Worker Management must show the weekly wage-table redesign")
check(weeklyWagePreview.includes("days: blankWeek()"), "A week without saved entries must open with blank daily wages")
check(weeklyWagePreview.includes("Array.from({ length: 3 }"), "Weekly wage table must include three custom-entry rows")
check(weeklyWagePreview.includes("Daily wage · groups show labour count × editable rate"), "Weekly wage headers must explain individual and group editing")
check(weeklyWagePreview.includes("fetchDailyWages"), "Weekly wage table must load saved daily wages")
check(weeklyWagePreview.includes("fetchLedger"), "Weekly wage table must load ledger movements for opening balance classification")
check(weeklyWagePreview.includes("saveDailyWageBatch"), "Weekly wage table must save daily wage rates and group counts")
check(weeklyWagePreview.includes("updateAccount"), "Weekly wage table must persist edited worker names and references")
check(weeklyWagePreview.includes("updateWeeklyPayment"), "Weekly wage table must persist the auto-calculated wage payment")
check(weeklyWagePreview.includes("createLedgerTransaction"), "Weekly wage table must persist cash advances in the Worker ledger")
check(weeklyWagePreview.includes("Save week"), "Weekly wage table must provide an operator save action")
check(weeklyWagePreview.includes("buildWageWeeks"), "Weekly wage table must derive Saturday–Friday dates from the live India calendar date")
check(weeklyWagePreview.includes("Object.values(wageWeeks)"), "Weekly wage table must offer the current and previous calendar weeks")
check(weeklyWagePreview.includes("useState<string | null>(null)"), "Time-dependent week dates must wait until the client mounts")
check(weeklyWagePreview.includes("syncCurrentWeek"), "Weekly wage table must refresh its calendar anchor after a week rollover")
check(weeklyWagePreview.includes("if (!wageWeeks || !selectedWeek)"), "Server rendering must use a stable loading state before live dates are known")
check(!weeklyWagePreview.includes("15–21 Aug 2026 · current week"), "Weekly wage table must not hard-code an expired current week")
check(!weeklyWagePreview.includes("moveCurrentWeekToPrevious"), "The completed one-time August wage move must not remain in the live UI")
check(weeklyWagePreview.includes("MOVED_WAGE_PLACEHOLDER_NOTE"), "Historical moved wage placeholders must remain readable as blank entries")
check(weeklyWagePreview.includes("Horizontal table scroll"), "Weekly wage table must provide a horizontal scrollbar above the table")
check(weeklyWagePreview.includes("w-[1502px] min-w-[1502px] table-fixed"), "Weekly wage table must keep compact fixed-width columns")
check(weeklyWagePreview.includes('<col className="w-[124px]" />'), "Cash paid in week must use a wider column")
check(/\r?\n\s+No\r?\n\s+<input/.test(weeklyWagePreview), "Group wage rows must label the daily labour count as No")
check(!weeklyWagePreview.includes("No. of labourers"), "The former wide labour-count label must be removed")
check(weeklyWagePreview.includes("groupDayWage"), "Group wages must multiply the wage rate by the labour count")
check(weeklyWagePreview.includes(": formatWholeINR(multipliedWage)"), "Group rows must display only the multiplied wage total")
check(weeklyWagePreview.includes("renderNameCell(row, rowIndex, 2)"), "Outside and custom groups must use paired table rows")
check(weeklyWagePreview.includes(">Wage<"), "The lower group row must label the editable wage per labourer as Wage")
check(!weeklyWagePreview.includes("Wage / labourer"), "The former wide wage-per-labourer label must be removed")
check(!weeklyWagePreview.includes("Enter count and wage"), "Blank custom group cells must not show an entry prompt")
check(weeklyWagePreview.includes("Export to Excel"), "Weekly wage table must offer an Excel-compatible export")
check(weeklyWagePreview.includes("selectedWeek.exportFile"), "Excel export filename must follow the dynamically selected week")
check(weeklyWagePreview.includes("buildWorkerWageWorkbook"), "Excel export must generate a typed XLSX workbook")
check(weeklyWagePreview.includes("calculateWageSheetTotals"), "UI and Excel export must share one Sheet Total aggregation")
check(weeklyWagePreview.includes("CombinedWeekWage"), "Selected worker week wages must support a three-line combined total")
check(weeklyWagePreview.includes('row.loadedName === "Tiruma" ? "Rani"'), "Tiruma's week wage must include Rani")
check(weeklyWagePreview.includes('row.loadedName === "Sivan" ? "Chitra"'), "Sivan's week wage must include Chitra")
check(weeklyWagePreview.includes('const dependentWorkerNames = new Set(["Rani", "Chitra"])'), "Rani and Chitra must be marked as dependent workers")
check(weeklyWagePreview.includes("to loan payment blank"), "Dependent worker financial columns must render blank")
check(weeklyWagePreview.includes("wageToBePaid(row, pairedWorker)"), "Guardian wage payment must use combined wages")
check(weeklyWagePreview.indexOf("To loan payment") < weeklyWagePreview.indexOf("Wage to be paid"), "Editable loan payment must appear before calculated wage payment")
check(weeklyWagePreview.includes("value={row.loanPayment}"), "To loan payment must be operator editable")
check(weeklyWagePreview.includes("combinedWeekWages(row, dependent) - amount(row.loanPayment)"), "Wage to be paid must calculate wages less loan payment")
check(weeklyWagePreview.includes('entry?.attendance_value === "ABSENT"'), "Saved absent days must reload as zero wages")
check(weeklyWagePreview.includes("wage_rate: String(entry.wageRateSnapshot)"), "Zero-attendance rows must retain a valid wage-rate snapshot")
check(weeklyWagePreview.includes("earlierLoanBalance: openingSignedBalance"), "Earlier balances must retain their signed ledger value")
check(weeklyWagePreview.includes('const openingBalanceReference = "OPEN-BAL"'), "Approved opening balance transactions must use the audited ledger reference")
check(weeklyWagePreview.includes("const weeklySignedCash = signedCash - openingAdjustment"), "Opening balances must be excluded from editable weekly advances")
check(weeklyWagePreview.includes("const cashPaid = Math.max(0, -weeklySignedCash)"), "Editable weekly advances must retain a non-negative input value")
check(weeklyWagePreview.includes("SignedCalculatedAmount"), "Signed balances must show positive and negative values")
check(weeklyWagePreview.includes("carryForwardPreviousBalances"), "Current-week earlier balances must roll forward automatically")
check(weeklyWagePreview.includes("previousBalanceByAccount"), "Balance rollover must match workers by database account")
check(weeklyWagePreview.includes("const balance = presentBalance(row)"), "Balance rollover must use the previous week's calculated present balance")
check(weeklyWagePreview.includes("loadedRows = carryForwardPreviousBalances(loadedRows, previousRows)"), "Current-week rows must receive the previous-week balances")
check(weeklyWagePreview.includes('selectedWeekId === "current"'), "Previous-week balance data must be loaded only for the current week")
check(weeklyWagePreview.includes('tone="green"'), "Week wages, wage payments, and loan payments must use green values")
check(/tone="red"\s+negative/.test(weeklyWagePreview), "In-week cash must use a red negative value")
check(weeklyWagePreview.includes('negative && value !== "" ? "−₹" : "₹"'), "Editable in-week cash must show a negative rupee prefix")
check(weeklyWagePreview.includes("window.print()"), "Weekly wage table must offer a print action")
check(weeklyWagePreview.includes("worker name`}"), "Every listed worker name must be operator editable")
check(weeklyWagePreview.includes("updateBaseWage"), "Changing a worker's base wage must update all seven daily wages")
check(!weeklyWagePreview.includes('type="number"'), "Weekly wage inputs must not show browser up/down spinner arrows")
check(weeklyWagePreview.includes('pattern="[0-9]*"'), "Weekly wage inputs must retain a numeric mobile keyboard without spinner controls")
check(weeklyWagePreview.includes("readWholeAmountInput"), "Weekly wage inputs must reject decimal and non-numeric characters")
check(weeklyWagePreview.includes("Number.isSafeInteger(labourerCount)"), "Group counts must be validated before any database write")
check(weeklyWagePreview.includes("Enter a whole number of labourers for"), "Invalid group counts must identify the worker and date")
check(weeklyWagePreview.includes("normaliseWeeklyWageEntry"), "Weekly wage saves must normalise blank numeric cells to zero")
check(weeklyWagePreview.includes("entry?.daily_wage_amount ?? baseWage"), "Reloaded partial-day rows must show the calculated wage rather than the full-rate snapshot")
check(weeklyWagePreview.includes("group_attendee_count: entry.groupAttendeeCount"), "Blank group counts must be sent as numeric zero instead of null")
check(weeklyWagePreview.includes("attendance: entry.attendance"), "Blank individual wages must be sent as absent instead of missing")
check(weeklyWagePreview.includes("const [loadSucceeded, setLoadSucceeded] = useState(false)"), "Saving must remain disabled until the database load succeeds")
check(weeklyWagePreview.includes("disabled={loading || saving || !loadSucceeded}"), "The Save action must remain disabled after a load failure")
check(weeklyWagePreview.includes("Reload the weekly wage sheet successfully before saving"), "The save handler must reject writes after a failed load")
check(weeklyWagePreview.includes("persistRowDatabaseState(row)"), "Created account IDs must be retained before later save steps run")
check(!weeklyWagePreview.includes("notes: movedBlank"), "New saves must not preserve blank cells as non-zero migration placeholders")
check(weeklyWagePreview.includes("maxLength={7}"), "Worker references must be limited to seven characters")
check(weeklyWagePreview.includes('"Base wage"'), "Excel export must include the editable base wage")
check(weeklyWagePreview.includes('"Reference"'), "Excel export must include the worker reference")
const workerPrintStyles = read("app/globals.css")
check(workerPrintStyles.includes(".weekly-wage-print"), "Worker wage print view must isolate the wage sheet")
check(workerPrintStyles.includes("size: A3 landscape"), "Wide worker wage table must print in landscape")

const dailyAttendance = read("components/worker-management/daily-attendance.tsx")
check(dailyAttendance.includes('title="Full attendance"'), "Daily Attendance needs a green full-attendance tick")
check(dailyAttendance.includes('title="Absent"'), "Daily Attendance needs a red absent mark")
for (const fraction of ["1/3", "1/2", "2/3"]) {
  check(dailyAttendance.includes(`"${fraction}"`), `Daily Attendance is missing the blue ${fraction} mark`)
}
check(dailyAttendance.includes("fetchAccounts({ isActive: true"), "Daily Attendance must load every active worker")
check(dailyAttendance.includes("datesForWeek"), "Daily Attendance must show the full Saturday-Friday week")
check(dailyAttendance.includes("No entry"), "Daily Attendance must distinguish a missing entry from an absence")
check(dailyAttendance.includes("readCachedDailyWages"), "Daily Attendance must remain available from the offline roster cache")
check(dailyAttendance.includes("Amount earned"), "Daily Attendance must add an earnings row beneath every worker")
check(dailyAttendance.includes("formatWholeINR(item.daily_wage_amount)"), "Daily earnings must use the saved daily wage amount")
check(dailyAttendance.includes("No earnings entered"), "Daily earnings must distinguish a missing wage from zero earnings")
check(dailyAttendance.includes("item.notes === MOVED_WAGE_PLACEHOLDER_NOTE"), "Moved wage placeholders must remain blank in Daily Attendance")

const workerServiceWorker = read("public/worker-management-sw.js")
check(workerServiceWorker.includes('"/worker-management/daily-attendance"'), "Daily Attendance must be included in the Worker offline shell")

const dailyEntry = read("components/worker-management/daily-wage-entry.tsx")
check(/if \(item\.account_type === "OUTSIDE"\) return \["FULL", "ABSENT"\]/.test(dailyEntry), "Outside Workers must allow only Full or Absent")
check(/item\.scheme_snapshot === "THREE_OPTION"[\s\S]*?"ONE_THIRD"/.test(dailyEntry), "Three-option Farm Workers must allow one-third day")
check(/item\.scheme_snapshot === "THREE_OPTION"[\s\S]*?"TWO_THIRDS"/.test(dailyEntry), "Three-option Farm Workers must allow two-thirds day")
check(dailyEntry.includes("formatWholeINR(item.daily_wage_amount)"), "Daily Wage Entry must display whole rupees without paise")
check(dailyEntry.includes("attendance_value: null"), "New Daily Wage rows must not default attendance")
check(dailyEntry.includes("group_attendee_count: null"), "New Group rows must require an explicit attendee count")
check(dailyEntry.includes("Selection required"), "Unselected Daily Wage rows need a visible required state")
check(dailyEntry.includes("Select attendance explicitly for every entry you save"), "Daily Wage Entry must explain explicit selection")
check(dailyEntry.includes(".toSorted(compareAccountCodes)"), "Daily Wage rows must use natural account-code order")
check(dailyEntry.includes("workerAccountOptionLabel(account)"), "Daily Wage account options must show code before name")
check(dailyEntry.includes("queueAttendanceOperations"), "Daily entry must save through the durable offline queue")
check(dailyEntry.includes("Offline roster loaded"), "Daily entry must load its cached roster offline")
check(dailyEntry.includes("Retry Device Entry"), "Attendance conflicts need an explicit device retry action")
check(dailyEntry.includes("item.notes === MOVED_WAGE_PLACEHOLDER_NOTE"), "Moved wage placeholders must remain unselected in Daily Wage Entry")

const workerDirectory = read("components/worker-management/worker-directory.tsx")
check(workerDirectory.includes("const [showInactive, setShowInactive] = useState(false)"), "Worker Directory must default to active accounts")
check(workerDirectory.includes("fetchAccounts({ isActive: true"), "Worker Directory must request active accounts explicitly")
check(workerDirectory.includes("fetchAccounts({ isActive: false"), "Worker Directory must request inactive accounts explicitly")
check(workerDirectory.includes("account.is_active === !showInactive"), "Worker Directory must separate active and inactive accounts")
check(workerDirectory.includes("Inactive Workers (${inactiveCount})"), "Worker Directory needs an Inactive Workers control")
check(workerDirectory.includes("Active Workers (${activeCount})"), "Inactive view needs a return to Active Workers")
check(workerDirectory.includes("aria-pressed={showInactive}"), "Inactive Workers control must expose its selected state")
check(workerDirectory.includes(".toSorted(compareAccountCodes)"), "Worker Directory must use natural account-code order")

const settlement = read("components/worker-management/weekly-settlement.tsx")
for (const heading of ["Week wages", "To loan payment", "Wage to be paid", "Earlier loan balance", "Cash paid in week", "Present balance"]) {
  check(settlement.includes(heading), `Settlement is missing ${heading}`)
}
check(settlement.includes("fetchLedger"), "Weekly Settlement must classify opening balances from the same ledger data as the wage sheet")
check(settlement.includes('const openingBalanceReference = "OPEN-BAL"'), "Weekly Settlement must use the approved opening-balance reference")
check(settlement.includes('row.display_name === "Tiruma" ? "Rani"'), "Weekly Settlement must add Rani's wages to Tiruma")
check(settlement.includes('row.display_name === "Sivan" ? "Chitra"'), "Weekly Settlement must add Chitra's wages to Sivan")
check(settlement.includes('const dependentWorkerNames = new Set(["Rani", "Chitra"])'), "Weekly Settlement must leave dependent financial columns blank")
check(settlement.includes("totalWeekWages - toLoanPayment"), "Wage to be paid must equal combined week wages less loan payment")
check(settlement.includes("earlierLoanBalance + toLoanPayment - cashPaidInWeek"), "Present balance must match the wage sheet formula")
check(settlement.includes("signedCash - openingAdjustment"), "Opening balances must not appear as cash paid in the week")
check(settlement.includes("row.wageToBePaid ?? 0"), "Saving loan payments must persist the calculated wage to be paid")
check(settlement.includes("To loan payment for ${row.display_name}"), "To loan payment must be editable under the matching wage-sheet heading")
check(settlement.includes("defaultSettlementDate"), "Settlement must default Saturday to the week that ended Friday")
check(settlement.includes('label="Week containing"'), "Settlement must allow an operator to select another work week")
check(settlement.includes("addDays(current, -7)"), "Settlement must support previous-week navigation")
check(settlement.includes(".toSorted(compareApprovedWorkerRoster)"), "Weekly Settlement must follow the shared account-code roster order")

const query = read("components/worker-management/worker-query.tsx")
check(query.includes("weekDate"), "Query must expose a work-week filter")
check(query.includes("hasCustomRange ? undefined"), "Custom date ranges must not remain pinned to the selected week")
check(query.includes("weekId: scopedWeekId"), "Wage and Loan queries must use the resolved week scope")

const formatting = read("lib/worker-management-format.ts")
check(formatting.includes('weekday === "Sat" ? addDays(indiaDate, -1)'), "Saturday settlement must resolve to the prior Friday")

const loanRegister = read("components/worker-management/loan-register.tsx")
check(loanRegister.includes('sign: "negative"'), "Cash advances and withdrawals need a negative sign rule")
check(loanRegister.includes('sign: "positive"'), "Repayments and contributions need a positive sign rule")
check(loanRegister.includes("SETTLEMENT_TRANSFER"), "Loan Register must identify wage transfers")
check(loanRegister.includes("Other movements"), "Loan Register must disclose deposit and cash-repayment variations")
check(loanRegister.includes("queueLedgerOperation"), "Loan advances must use unique durable offline operations")
check(loanRegister.includes("Device transaction queue"), "Loan Register must show queued device transactions")
check(loanRegister.includes("accounts.toSorted(compareAccountCodes)"), "Signed worker accounts must use natural account-code order")
check(loanRegister.includes("workerAccountOptionLabel(account)"), "Loan Register options must show code before name")
check(!loanRegister.includes("accountId: current.accountId ||"), "Loan Register must not select an account by default")
check(loanRegister.includes('accountId: ""'), "Loan Register must clear the account after each saved transaction")
check(loanRegister.includes("!form.accountId"), "Loan Register must require an explicit account before saving")

const offlineStore = read("lib/worker-management-offline.ts")
check(offlineStore.includes("const DATABASE_VERSION = 2"), "Preview pilot must reset legacy Worker offline storage")
check(offlineStore.includes("database.deleteObjectStore(storeName)"), "Worker offline upgrade must remove legacy UAT stores")
for (const state of ["SAVED_ON_DEVICE", "WAITING_TO_SYNC", "SYNCED", "CONFLICT"]) {
  check(offlineStore.includes(`"${state}"`), `Offline store is missing ${state}`)
}
check(offlineStore.includes('createObjectStore(OPERATIONS'), "Offline store needs a durable operations outbox")
check(offlineStore.includes("last_known_server_row_version"), "Offline attendance must carry its server row version")
check(offlineStore.includes("crypto.randomUUID()"), "Offline operations need globally unique IDs")
check(offlineStore.includes("for (let page = 0; page < 20"), "Offline pull must advance through cursor pages")

const offlineProvider = read("components/worker-management/worker-offline-provider.tsx")
check(offlineProvider.includes('window.addEventListener("online"'), "Reconnect must trigger Worker synchronisation")
check(offlineProvider.includes('register("/worker-management-sw.js"'), "Worker service worker must be registered")

const serviceWorker = read("public/worker-management-sw.js")
check(serviceWorker.includes('url.pathname.startsWith("/api/")'), "Service worker must never cache Worker API responses")
check(serviceWorker.includes("WORKER_SHELL"), "Service worker must cache the Worker application shell")
check(existsSync(join(root, "public/worker-management.webmanifest")), "Worker PWA manifest is missing")

const bff = read("app/api/worker-management/[[...path]]/route.ts")
check(bff.includes('"X-MFMS-Authenticated-Signature"'), "BFF must forward its HMAC signature")
check(bff.includes('"X-MFMS-Authenticated-User-Timestamp"'), "BFF must complete the operational user assertion")
check(bff.includes('"X-MFMS-Authenticated-User-Signature"'), "BFF must sign the operational user assertion")
check(bff.includes("resolveWorkerActor(request.headers, process.env)"), "BFF must derive its actor from trusted identity configuration")
check(!bff.includes('request.headers.get("x-mfms-authenticated-user")'), "BFF must not trust a browser actor assertion")
check(bff.includes("AbortSignal.timeout(30_000)"), "BFF needs a bounded backend timeout")
check(bff.includes("export function POST"), "BFF must proxy offline sync push requests")

const workerApi = read("lib/worker-management-api.ts")
check(workerApi.includes("normaliseWorkerError"), "Worker API errors must be normalised for display")
check(workerApi.includes("record.message"), "Structured FastAPI detail messages must remain readable")
check(workerApi.includes("friendlyWorkerErrorMessage"), "Technical Worker field names must be converted into operator-readable errors")

console.log(`worker-management: ${assertions} assertions passed`)
