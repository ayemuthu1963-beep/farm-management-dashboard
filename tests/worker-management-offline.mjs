import assert from "node:assert/strict"
import { IDBKeyRange, indexedDB } from "fake-indexeddb"

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const offline = await import("../lib/worker-management-offline.ts")

function attendanceInput(attendance = "FULL", version = null) {
  return {
    account_id: 1,
    attendance,
    group_attendee_count: null,
    notes: null,
    expected_row_version: version,
  }
}

function dailyResponse(attendance = "HALF", rowVersion = 9) {
  return {
    work_date: "2026-08-10",
    week: {
      week_id: 1,
      start_date: "2026-08-08",
      end_date: "2026-08-14",
      status: "DRAFT",
      version_no: 1,
      row_version: 1,
    },
    items: [
      {
        attendance_id: 11,
        account_id: 1,
        account_code: "FW-001",
        account_type: "FARM",
        display_name: "Arjun Kumar",
        group_leader_name: null,
        default_group_size: null,
        work_date: "2026-08-10",
        attendance_value: attendance,
        group_attendee_count: null,
        wage_rate_snapshot: "600.00",
        scheme_snapshot: "THREE_OPTION",
        daily_wage_amount: attendance === "HALF" ? "300.00" : "600.00",
        notes: null,
        entry_status: "POSTED",
        row_version: rowVersion,
        is_default: false,
      },
    ],
    available_accounts: [],
  }
}

await offline.deleteWorkerOfflineDatabaseForTests()

const firstQueue = await offline.queueAttendanceOperations(
  "2026-08-10",
  [attendanceInput("FULL")],
)
const secondQueue = await offline.queueAttendanceOperations(
  "2026-08-10",
  [attendanceInput("HALF")],
)
assert.equal(firstQueue[0].operation_id, secondQueue[0].operation_id, "offline edits must coalesce before sync")
assert.equal((await offline.getWorkerOfflineSnapshot()).waiting, 1)
assert.equal(secondQueue[0].state, "SAVED_ON_DEVICE")

await offline.resetWorkerOfflineConnectionForTests()
const afterRestart = await offline.getWorkerOfflineSnapshot()
assert.equal(afterRestart.waiting, 1, "queued data must survive an application restart")
assert.equal(afterRestart.operations[0].payload.attendance, "HALF")

let pushCount = 0
const successfulDependencies = {
  online: true,
  push: async (operations) => {
    pushCount += 1
    return {
      results: operations.map((operation) => ({
        operation_id: operation.operation_id,
        status: "SYNCED",
        result: { row_version: 1 },
        detail: null,
      })),
      next_cursor: 7,
    }
  },
  pull: async () => ({ changes: [], next_cursor: 7, has_more: false }),
}

const synced = await offline.syncWorkerOutbox(successfulDependencies)
assert.equal(synced.pushed, 1)
assert.equal(synced.waiting, 0)
assert.equal(synced.cursor, 7)
assert.ok(synced.lastSync)
await offline.syncWorkerOutbox(successfulDependencies)
assert.equal(pushCount, 1, "a synced operation must never be pushed twice")

const advanceOne = await offline.queueLedgerOperation({
  account_id: 1,
  transaction_date: "2026-08-10",
  transaction_type: "CASH_ADVANCE",
  amount: "200.00",
  reference: "Advance one",
  notes: null,
})
const advanceTwo = await offline.queueLedgerOperation({
  account_id: 1,
  transaction_date: "2026-08-10",
  transaction_type: "CASH_ADVANCE",
  amount: "300.00",
  reference: "Advance two",
  notes: null,
})
assert.notEqual(advanceOne.operation_id, advanceTwo.operation_id, "distinct advances need distinct IDs")

await offline.syncWorkerOutbox(successfulDependencies)
assert.equal((await offline.getWorkerOfflineSnapshot()).waiting, 0)

await offline.queueAttendanceOperations("2026-08-10", [attendanceInput("ABSENT", 4)])
const conflictRun = await offline.syncWorkerOutbox({
  online: true,
  push: async (operations) => ({
    results: operations.map((operation) => ({
      operation_id: operation.operation_id,
      status: "CONFLICT",
      result: null,
      detail: "Daily entry changed concurrently; reload and retry.",
    })),
    next_cursor: 8,
  }),
  pull: async (cursor) => ({ changes: [], next_cursor: cursor, has_more: false }),
})
assert.equal(conflictRun.conflicts, 1)
const conflict = conflictRun.operations.find((operation) => operation.state === "CONFLICT")
assert.ok(conflict)

await offline.attachAttendanceServerSnapshots(dailyResponse("HALF", 9))
await offline.resolveAttendanceConflict(conflict.operation_id, "LOCAL")
const retried = (await offline.getWorkerOfflineSnapshot()).operations.find(
  (operation) => operation.state === "WAITING_TO_SYNC" && operation.entity_type === "ATTENDANCE",
)
assert.ok(retried)
assert.notEqual(retried.operation_id, conflict.operation_id)
assert.equal(retried.last_known_server_row_version, 9)
assert.equal(retried.payload.attendance, "ABSENT")

await offline.deleteWorkerOfflineDatabaseForTests()
console.log("worker-management-offline: IndexedDB, restart, idempotency, advances, and conflict checks passed")
