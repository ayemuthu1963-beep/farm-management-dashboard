import type {
  AttendanceSyncPayload,
  DailyWageItem,
  DailyWageResponse,
  LedgerSyncPayload,
  WorkerAccount,
  WorkerSyncOperation,
  WorkerSyncPullResponse,
  WorkerSyncPushResponse,
} from "./worker-management-types"

export type WorkerLocalSyncState =
  | "SAVED_ON_DEVICE"
  | "WAITING_TO_SYNC"
  | "SYNCED"
  | "CONFLICT"

export type WorkerLocalOperation = WorkerSyncOperation & {
  entity_key: string
  state: WorkerLocalSyncState
  created_at: string
  updated_at: string
  attempts: number
  detail: string | null
  official_result: unknown
  server_snapshot?: DailyWageItem | null
  resolution?: "SERVER" | "LOCAL_RETRY"
}

export type WorkerOfflineSnapshot = {
  waiting: number
  conflicts: number
  lastSync: string | null
  cursor: number
  operations: WorkerLocalOperation[]
}

export type WorkerSyncRun = WorkerOfflineSnapshot & {
  pushed: number
  changes: number
}

type CachedRoster = {
  work_date: string
  cached_at: string
  value: DailyWageResponse
}

type CachedAccounts = {
  key: "active"
  cached_at: string
  value: WorkerAccount[]
}

type MetaRecord = {
  key: string
  value: string | number
}

type SyncDependencies = {
  online?: boolean
  push: (operations: WorkerSyncOperation[]) => Promise<WorkerSyncPushResponse>
  pull: (cursor: number, limit?: number) => Promise<WorkerSyncPullResponse>
}

const DATABASE_NAME = "mfms-worker-management"
const DATABASE_VERSION = 2
const ROSTERS = "rosters"
const ACCOUNTS = "accounts"
const OPERATIONS = "operations"
const META = "meta"
const DEVICE_ID = "device_id"
const SYNC_CURSOR = "sync_cursor"
const LAST_SYNC = "last_sync"

let databasePromise: Promise<IDBDatabase> | null = null
let activeSync: Promise<WorkerSyncRun> | null = null

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("Offline storage is not supported in this browser.")
  }
  return indexedDB
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."))
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  let openPromise: Promise<IDBDatabase>
  let settled = false
  openPromise = new Promise((resolve, reject) => {
    const request = requireIndexedDb().open(DATABASE_NAME, DATABASE_VERSION)
    const clearCachedPromise = () => {
      if (databasePromise === openPromise) databasePromise = null
    }
    request.onupgradeneeded = (event) => {
      const database = request.result
      if (event.oldVersion > 0 && event.oldVersion < DATABASE_VERSION) {
        for (const storeName of [ROSTERS, ACCOUNTS, OPERATIONS, META]) {
          if (database.objectStoreNames.contains(storeName)) {
            database.deleteObjectStore(storeName)
          }
        }
      }
      if (!database.objectStoreNames.contains(ROSTERS)) {
        database.createObjectStore(ROSTERS, { keyPath: "work_date" })
      }
      if (!database.objectStoreNames.contains(ACCOUNTS)) {
        database.createObjectStore(ACCOUNTS, { keyPath: "key" })
      }
      if (!database.objectStoreNames.contains(OPERATIONS)) {
        const store = database.createObjectStore(OPERATIONS, { keyPath: "operation_id" })
        store.createIndex("by_entity_key", "entity_key", { unique: false })
        store.createIndex("by_state", "state", { unique: false })
        store.createIndex("by_entity_type", "entity_type", { unique: false })
      }
      if (!database.objectStoreNames.contains(META)) {
        database.createObjectStore(META, { keyPath: "key" })
      }
    }
    request.onsuccess = () => {
      if (settled) {
        request.result.close()
        return
      }
      settled = true
      request.result.onversionchange = () => {
        request.result.close()
        clearCachedPromise()
      }
      resolve(request.result)
    }
    request.onerror = () => {
      if (settled) return
      settled = true
      clearCachedPromise()
      reject(request.error ?? new Error("Unable to open Worker offline storage."))
    }
    request.onblocked = () => {
      if (settled) return
      settled = true
      clearCachedPromise()
      reject(new Error("Worker offline storage upgrade is blocked by another tab."))
    }
  })
  databasePromise = openPromise
  return openPromise
}

async function getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, "readonly")
  const result = await requestResult(transaction.objectStore(storeName).get(key))
  await transactionDone(transaction)
  return result as T | undefined
}

async function putRecord(storeName: string, value: unknown): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, "readwrite")
  transaction.objectStore(storeName).put(value)
  await transactionDone(transaction)
}

async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, "readwrite")
  transaction.objectStore(storeName).delete(key)
  await transactionDone(transaction)
}

async function allOperations(): Promise<WorkerLocalOperation[]> {
  const database = await openDatabase()
  const transaction = database.transaction(OPERATIONS, "readonly")
  const result = await requestResult(transaction.objectStore(OPERATIONS).getAll())
  await transactionDone(transaction)
  return (result as WorkerLocalOperation[]).toSorted((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  )
}

async function operationsForEntity(entityKey: string): Promise<WorkerLocalOperation[]> {
  const database = await openDatabase()
  const transaction = database.transaction(OPERATIONS, "readonly")
  const result = await requestResult(
    transaction.objectStore(OPERATIONS).index("by_entity_key").getAll(entityKey),
  )
  await transactionDone(transaction)
  return (result as WorkerLocalOperation[]).toSorted((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  )
}

async function getMeta(key: string): Promise<string | number | undefined> {
  return (await getRecord<MetaRecord>(META, key))?.value
}

async function setMeta(key: string, value: string | number): Promise<void> {
  await putRecord(META, { key, value } satisfies MetaRecord)
}

async function workerDeviceId(): Promise<string> {
  const existing = await getMeta(DEVICE_ID)
  if (typeof existing === "string" && existing) return existing
  const created = crypto.randomUUID()
  await setMeta(DEVICE_ID, created)
  return created
}

function attendanceEntityKey(workDate: string, accountId: number): string {
  return `ATTENDANCE:${workDate}:${accountId}`
}

function notifyOfflineChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("mfms-worker-offline-change"))
  }
}

export async function cacheDailyWages(value: DailyWageResponse): Promise<void> {
  await putRecord(ROSTERS, {
    work_date: value.work_date,
    cached_at: new Date().toISOString(),
    value,
  } satisfies CachedRoster)
}

export async function readCachedDailyWages(workDate: string): Promise<DailyWageResponse | null> {
  return (await getRecord<CachedRoster>(ROSTERS, workDate))?.value ?? null
}

export async function cacheWorkerAccounts(value: WorkerAccount[]): Promise<void> {
  await putRecord(ACCOUNTS, {
    key: "active",
    cached_at: new Date().toISOString(),
    value,
  } satisfies CachedAccounts)
}

export async function readCachedWorkerAccounts(): Promise<WorkerAccount[]> {
  return (await getRecord<CachedAccounts>(ACCOUNTS, "active"))?.value ?? []
}

export async function queueAttendanceOperations(
  workDate: string,
  items: Array<{
    account_id: number
    attendance: AttendanceSyncPayload["attendance"]
    group_attendee_count: number | null
    notes: string | null
    expected_row_version: number | null
  }>,
): Promise<WorkerLocalOperation[]> {
  const deviceId = await workerDeviceId()
  const queued: WorkerLocalOperation[] = []
  for (const item of items) {
    const entityKey = attendanceEntityKey(workDate, item.account_id)
    const existing = await operationsForEntity(entityKey)
    const conflict = existing.find((operation) => operation.state === "CONFLICT")
    if (conflict) {
      throw new Error("Resolve the existing attendance conflict before saving another change.")
    }
    const waiting = existing.find((operation) =>
      operation.state === "WAITING_TO_SYNC" || operation.state === "SAVED_ON_DEVICE",
    )
    const now = new Date().toISOString()
    const operation: WorkerLocalOperation = {
      operation_id: waiting?.operation_id ?? crypto.randomUUID(),
      device_id: deviceId,
      entity_type: "ATTENDANCE",
      entity_key: entityKey,
      last_known_server_row_version: item.expected_row_version,
      client_timestamp: now,
      payload: {
        work_date: workDate,
        account_id: item.account_id,
        attendance: item.attendance,
        group_attendee_count: item.group_attendee_count,
        notes: item.notes,
      },
      state: "SAVED_ON_DEVICE",
      created_at: waiting?.created_at ?? now,
      updated_at: now,
      attempts: waiting?.attempts ?? 0,
      detail: null,
      official_result: null,
    }
    await putRecord(OPERATIONS, operation)
    queued.push(operation)
  }
  notifyOfflineChange()
  return queued
}

export async function queueLedgerOperation(payload: LedgerSyncPayload): Promise<WorkerLocalOperation> {
  const now = new Date().toISOString()
  const operation: WorkerLocalOperation = {
    operation_id: crypto.randomUUID(),
    device_id: await workerDeviceId(),
    entity_type: "LEDGER",
    entity_key: `LEDGER:${payload.transaction_date}:${payload.account_id}:${crypto.randomUUID()}`,
    last_known_server_row_version: null,
    client_timestamp: now,
    payload,
    state: "SAVED_ON_DEVICE",
    created_at: now,
    updated_at: now,
    attempts: 0,
    detail: null,
    official_result: null,
  }
  await putRecord(OPERATIONS, operation)
  notifyOfflineChange()
  return operation
}

export async function getWorkerOfflineSnapshot(): Promise<WorkerOfflineSnapshot> {
  const operations = await allOperations()
  return {
    waiting: operations.filter((operation) =>
      operation.state === "SAVED_ON_DEVICE" || operation.state === "WAITING_TO_SYNC",
    ).length,
    conflicts: operations.filter((operation) => operation.state === "CONFLICT").length,
    lastSync: ((await getMeta(LAST_SYNC)) as string | undefined) ?? null,
    cursor: Number(await getMeta(SYNC_CURSOR) ?? 0),
    operations,
  }
}

export async function getAttendanceOperations(workDate: string): Promise<WorkerLocalOperation[]> {
  return (await allOperations()).filter(
    (operation) => operation.entity_type === "ATTENDANCE" && operation.payload.work_date === workDate,
  )
}

export async function getPendingLedgerOperations(): Promise<WorkerLocalOperation[]> {
  return (await allOperations()).filter(
    (operation) => operation.entity_type === "LEDGER" && operation.state !== "SYNCED",
  )
}

function protocolOperation(operation: WorkerLocalOperation): WorkerSyncOperation {
  const {
    operation_id,
    device_id,
    entity_type,
    last_known_server_row_version,
    client_timestamp,
    payload,
  } = operation
  return {
    operation_id,
    device_id,
    entity_type,
    last_known_server_row_version,
    client_timestamp,
    payload,
  } as WorkerSyncOperation
}

async function runSync(dependencies: SyncDependencies): Promise<WorkerSyncRun> {
  const online = dependencies.online ?? (typeof navigator !== "undefined" && navigator.onLine)
  const before = await getWorkerOfflineSnapshot()
  if (!online) return { ...before, pushed: 0, changes: 0 }

  const waiting = before.operations.filter((operation) =>
    operation.state === "SAVED_ON_DEVICE" || operation.state === "WAITING_TO_SYNC",
  )
  let pushed = 0
  if (waiting.length) {
    const waitingAt = new Date().toISOString()
    for (const operation of waiting) {
      await putRecord(OPERATIONS, {
        ...operation,
        state: "WAITING_TO_SYNC",
        updated_at: waitingAt,
      } satisfies WorkerLocalOperation)
    }
    const response = await dependencies.push(waiting.map(protocolOperation))
    const byId = new Map(response.results.map((result) => [result.operation_id, result]))
    for (const operation of waiting) {
      const result = byId.get(operation.operation_id)
      if (!result) continue
      const status: WorkerLocalSyncState = result.status === "SYNCED" ? "SYNCED" : "CONFLICT"
      await putRecord(OPERATIONS, {
        ...operation,
        state: status,
        updated_at: new Date().toISOString(),
        attempts: operation.attempts + 1,
        detail: result.detail,
        official_result: result.result,
      } satisfies WorkerLocalOperation)
      if (result.status === "SYNCED") pushed += 1
    }
  }

  let cursor = Number(await getMeta(SYNC_CURSOR) ?? 0)
  let changes = 0
  for (let page = 0; page < 20; page += 1) {
    const pulled = await dependencies.pull(cursor, 250)
    changes += pulled.changes.length
    cursor = pulled.next_cursor
    await setMeta(SYNC_CURSOR, cursor)
    if (!pulled.has_more) break
  }
  const lastSync = new Date().toISOString()
  await setMeta(LAST_SYNC, lastSync)
  notifyOfflineChange()
  const after = await getWorkerOfflineSnapshot()
  return { ...after, lastSync, pushed, changes }
}

export function syncWorkerOutbox(dependencies: SyncDependencies): Promise<WorkerSyncRun> {
  if (activeSync) return activeSync
  activeSync = runSync(dependencies).finally(() => {
    activeSync = null
  })
  return activeSync
}

export async function attachAttendanceServerSnapshots(value: DailyWageResponse): Promise<void> {
  const operations = await getAttendanceOperations(value.work_date)
  for (const operation of operations.filter((item) => item.state === "CONFLICT")) {
    const serverSnapshot = value.items.find(
      (item) => item.account_id === operation.payload.account_id,
    ) ?? null
    await putRecord(OPERATIONS, { ...operation, server_snapshot: serverSnapshot })
  }
}

export async function resolveAttendanceConflict(
  operationId: string,
  resolution: "SERVER" | "LOCAL",
): Promise<WorkerLocalOperation | null> {
  const operation = await getRecord<WorkerLocalOperation>(OPERATIONS, operationId)
  if (!operation || operation.entity_type !== "ATTENDANCE" || operation.state !== "CONFLICT") {
    return null
  }
  const now = new Date().toISOString()
  if (resolution === "SERVER") {
    const resolved = { ...operation, state: "SYNCED" as const, resolution: "SERVER" as const, updated_at: now }
    await putRecord(OPERATIONS, resolved)
    notifyOfflineChange()
    return resolved
  }
  const serverVersion = operation.server_snapshot?.row_version
  if (!serverVersion) {
    throw new Error("The current server entry must be loaded before retrying this device entry.")
  }
  const retried: WorkerLocalOperation = {
    ...operation,
    operation_id: crypto.randomUUID(),
    last_known_server_row_version: serverVersion,
    state: "WAITING_TO_SYNC",
    created_at: now,
    updated_at: now,
    attempts: 0,
    detail: null,
    official_result: null,
    server_snapshot: operation.server_snapshot,
  }
  await putRecord(OPERATIONS, {
    ...operation,
    state: "SYNCED",
    resolution: "LOCAL_RETRY",
    updated_at: now,
  } satisfies WorkerLocalOperation)
  await putRecord(OPERATIONS, retried)
  notifyOfflineChange()
  return retried
}

export async function discardWorkerOperation(operationId: string): Promise<void> {
  await deleteRecord(OPERATIONS, operationId)
  notifyOfflineChange()
}

export async function resetWorkerOfflineConnectionForTests(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise
    database.close()
    databasePromise = null
  }
}

export async function deleteWorkerOfflineDatabaseForTests(): Promise<void> {
  await resetWorkerOfflineConnectionForTests()
  await new Promise<void>((resolve, reject) => {
    const request = requireIndexedDb().deleteDatabase(DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error("Unable to clear Worker offline storage."))
    request.onblocked = () => reject(new Error("Worker offline storage is still open."))
  })
}
