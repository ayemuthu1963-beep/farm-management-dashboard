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
  calculateDailyWage,
  compareAccountCodes,
  defaultSettlementDate,
  workerAccountOptionLabel,
} from "../lib/worker-management-format.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(join(root, path), "utf8")

let assertions = 0
const check = (condition, message) => {
  assert.ok(condition, message)
  assertions += 1
}

assert.equal(defaultSettlementDate(new Date("2026-08-08T06:00:00Z")), "2026-08-07")
assert.equal(defaultSettlementDate(new Date("2026-08-10T06:00:00Z")), "2026-08-10")
assertions += 2

for (const [rate, expectedTwoThirds, expectedOneThird] of [
  [400, 266, 133],
  [350, 233, 116],
  [300, 200, 100],
]) {
  assert.equal(calculateDailyWage(rate, "TWO_THIRDS", null, "FARM"), expectedTwoThirds)
  assert.equal(calculateDailyWage(rate, "ONE_THIRD", null, "FARM"), expectedOneThird)
  assertions += 2
}

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
check(weeklyWagePreview.includes("saveDailyWageBatch"), "Weekly wage table must save daily wage rates and group counts")
check(weeklyWagePreview.includes("updateAccount"), "Weekly wage table must persist edited worker names and references")
check(weeklyWagePreview.includes("updateWeeklyPayment"), "Weekly wage table must persist each wage cash payment")
check(weeklyWagePreview.includes("createLedgerTransaction"), "Weekly wage table must persist cash advances in the Worker ledger")
check(weeklyWagePreview.includes("Save week"), "Weekly wage table must provide an operator save action")
check(weeklyWagePreview.includes('value="previous"'), "Weekly wage table must let the operator view 8–14 August")
check(weeklyWagePreview.includes("moveCurrentWeekToPrevious"), "Weekly wage table must support the approved week correction")
check(weeklyWagePreview.includes("MOVED_WAGE_PLACEHOLDER_NOTE"), "The corrected current-week rows must retain an audit note")
check(weeklyWagePreview.includes('attendance: item.account_type === "GROUP" ? null : "FULL"'), "Moved daily wage rows must use a database-valid placeholder")
check(weeklyWagePreview.includes('wage_rate: "0"'), "Moved current-week rows must persist with zero wages")
check(weeklyWagePreview.includes("Horizontal table scroll"), "Weekly wage table must provide a horizontal scrollbar above the table")
check(weeklyWagePreview.includes("w-[1480px] min-w-[1480px] table-fixed"), "Weekly wage table must keep compact fixed-width columns")
check(/\r?\n\s+No\r?\n\s+<input/.test(weeklyWagePreview), "Group wage rows must label the daily labour count as No")
check(!weeklyWagePreview.includes("No. of labourers"), "The former wide labour-count label must be removed")
check(weeklyWagePreview.includes("groupDayWage"), "Group wages must multiply the wage rate by the labour count")
check(weeklyWagePreview.includes(": formatWholeINR(multipliedWage)"), "Group rows must display only the multiplied wage total")
check(weeklyWagePreview.includes("renderNameCell(row, rowIndex, 2)"), "Outside and custom groups must use paired table rows")
check(weeklyWagePreview.includes(">Wage<"), "The lower group row must label the editable wage per labourer as Wage")
check(!weeklyWagePreview.includes("Wage / labourer"), "The former wide wage-per-labourer label must be removed")
check(weeklyWagePreview.includes("Export to Excel"), "Weekly wage table must offer an Excel-compatible export")
check(weeklyWagePreview.includes("worker-wages-15-21-Aug-2026.csv"), "Excel export must download the current wage sheet")
check(weeklyWagePreview.includes("worker-wages-08-14-Aug-2026.csv"), "Excel export must support the corrected previous week")
check(weeklyWagePreview.includes("CombinedWeekWage"), "Selected worker week wages must support a three-line combined total")
check(weeklyWagePreview.includes('row.loadedName === "Tiruma" ? "Rani"'), "Tiruma's week wage must include Rani")
check(weeklyWagePreview.includes('row.loadedName === "Sivan" ? "Chitra"'), "Sivan's week wage must include Chitra")
check(weeklyWagePreview.includes('tone="green"'), "Week wages, cash paid, and loan repayment must use green values")
check(weeklyWagePreview.includes('tone="red" negative'), "Balances and in-week cash must use red negative values")
check(weeklyWagePreview.includes('negative && value !== "" ? "−₹" : "₹"'), "Editable in-week cash must show a negative rupee prefix")
check(weeklyWagePreview.includes("window.print()"), "Weekly wage table must offer a print action")
check(weeklyWagePreview.includes("worker name`}"), "Every listed worker name must be operator editable")
check(weeklyWagePreview.includes("updateBaseWage"), "Changing a worker's base wage must update all seven daily wages")
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
for (const heading of ["Wages", "Cash Paid During Week", "Weekly Payment", "Balance to Loan"]) {
  check(settlement.includes(heading), `Settlement is missing ${heading}`)
}
check(settlement.includes("money(item.wages) - weeklyPayment"), "Balance to Loan must equal Wages minus Weekly Payment")
check(settlement.includes("read-only from the Loan Register"), "Cash Paid During Week must be documented as read-only")
check(settlement.includes("defaultSettlementDate"), "Settlement must default Saturday to the week that ended Friday")
check(settlement.includes('label="Week containing"'), "Settlement must allow an operator to select another work week")
check(settlement.includes("addDays(current, -7)"), "Settlement must support previous-week navigation")
check(settlement.includes(".toSorted(compareAccountCodes)"), "Weekly Settlement must use natural account-code order")

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

console.log(`worker-management: ${assertions} assertions passed`)
