import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  actorCanonicalString,
  resolveWorkerActor,
  sha256Hex,
  signActorAssertion,
  WorkerBffError,
} from "../lib/worker-management-signing.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(join(root, path), "utf8")

let assertions = 0
const check = (condition, message) => {
  assert.ok(condition, message)
  assertions += 1
}

const body = '{"weekly_payment":"500.00"}'
const bodySha256 = sha256Hex(body)
assert.equal(bodySha256, "2c904ae5ea860e4361446cf93a99b827ed52936a71ceefde4d43e18b17f86258")
assertions += 1

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
      "X-MFMS-Role": "admin",
      "X-MFMS-Environment": "preview",
      "X-MFMS-Authenticated-User": "spoofed-browser-user",
    }),
    { MFMS_ENV: "preview", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" },
  ),
  { username: "preview-admin", role: "admin", environment: "preview" },
)
assertions += 1

assert.throws(
  () =>
    resolveWorkerActor(
      new Headers({
        "X-MFMS-User": "preview-admin",
        "X-MFMS-Role": "admin",
        "X-MFMS-Environment": "production",
      }),
      { MFMS_ENV: "preview", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" },
    ),
  (error) => error instanceof WorkerBffError && error.status === 401,
)
assertions += 1

assert.throws(
  () => signActorAssertion("short", signingInput),
  (error) => error instanceof WorkerBffError && error.status === 503,
)
assertions += 1

const routeFiles = [
  "app/worker-management/page.tsx",
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
  'label: "Daily Wage Entry"',
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

const dailyEntry = read("components/worker-management/daily-wage-entry.tsx")
check(/if \(item\.account_type === "OUTSIDE"\) return \["FULL", "ABSENT"\]/.test(dailyEntry), "Outside Workers must allow only Full or Absent")
check(/item\.scheme_snapshot === "THREE_OPTION"[\s\S]*?"ONE_THIRD"/.test(dailyEntry), "Three-option Farm Workers must allow one-third day")
check(/filter\(\(item\) => item\.is_default && !states\.has\(item\.account_id\)\)/.test(dailyEntry), "Unsynced default Farm rows must be ready to save")
check(dailyEntry.includes("queueAttendanceOperations"), "Daily entry must save through the durable offline queue")
check(dailyEntry.includes("Offline roster loaded"), "Daily entry must load its cached roster offline")
check(dailyEntry.includes("Retry Device Entry"), "Attendance conflicts need an explicit device retry action")

const settlement = read("components/worker-management/weekly-settlement.tsx")
for (const heading of ["Wages", "Cash Paid During Week", "Weekly Payment", "Balance to Loan"]) {
  check(settlement.includes(heading), `Settlement is missing ${heading}`)
}
check(settlement.includes("money(item.wages) - weeklyPayment"), "Balance to Loan must equal Wages minus Weekly Payment")
check(settlement.includes("read-only from the Loan Register"), "Cash Paid During Week must be documented as read-only")

const loanRegister = read("components/worker-management/loan-register.tsx")
check(loanRegister.includes('sign: "negative"'), "Cash advances and withdrawals need a negative sign rule")
check(loanRegister.includes('sign: "positive"'), "Repayments and contributions need a positive sign rule")
check(loanRegister.includes("SETTLEMENT_TRANSFER"), "Loan Register must identify wage transfers")
check(loanRegister.includes("Other movements"), "Loan Register must disclose deposit and cash-repayment variations")
check(loanRegister.includes("queueLedgerOperation"), "Loan advances must use unique durable offline operations")
check(loanRegister.includes("Device transaction queue"), "Loan Register must show queued device transactions")

const offlineStore = read("lib/worker-management-offline.ts")
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
check(bff.includes("resolveWorkerActor(request.headers, process.env)"), "BFF must derive its actor from trusted identity configuration")
check(!bff.includes('request.headers.get("x-mfms-authenticated-user")'), "BFF must not trust a browser actor assertion")
check(bff.includes("AbortSignal.timeout(30_000)"), "BFF needs a bounded backend timeout")
check(bff.includes("export function POST"), "BFF must proxy offline sync push requests")

console.log(`worker-management: ${assertions} assertions passed`)
