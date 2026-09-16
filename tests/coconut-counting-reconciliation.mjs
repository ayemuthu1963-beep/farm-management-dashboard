import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  calculateWorkbookValues,
  createRequestAbortScope,
  formatReconciliationNumber,
  formatReconciliationPercent,
  reconciliationDataResult,
  reconciliationInitialState,
} from "../lib/coconut-counting-reconciliation.ts"
import {
  isHarvestCycleWriteAllowed,
  REQUIRED_PRODUCTION_WRITE_APPROVAL,
} from "../lib/coconut-counting-write-gate.ts"
import { COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL } from "../lib/coconut-counting-write-policy.ts"
import { getAdminTargetSafetyErrors } from "../lib/preview-admin-write-safety.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const component = read("components/coconut-counting/reconciliation-table.tsx")
const editor = read("components/coconut-counting/harvested-editor.tsx")
const page = read("app/coconut-counting/page.tsx")
const readRoute = read("app/api/coconut-counting/reconciliation/route.ts")
const serverApi = read("lib/coconut-counting-reconciliation-api.ts")
const reconciliationLibrary = read("lib/coconut-counting-reconciliation.ts")
const writeRoute = read("app/api/coconut-counting-admin/cycles/[cycle]/plots/[plot]/harvested/route.ts")
const cycleView = read("app/coconut-harvest/cycle-view/page.tsx")
const harvestApi = read("lib/coconut-harvest-api.ts")

const safePreviewWriteEnvironment = {
  MFMS_ENV: "preview",
  NEXT_PUBLIC_MFMS_ENV: "preview",
  MFMS_ENABLE_LOCAL_WRITE_GUARD: "true",
  MFMS_TARGET_DATABASE: "mfms_server_uat",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_uat",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api-pilot",
  MFMS_LOCAL_WRITE_BACKEND_PORT: "8000",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api-pilot",
  MFMS_ALLOWED_BACKEND_PORT: "8000",
  MFMS_BUILD_ENVIRONMENT: "Preview",
  MFMS_GIT_COMMIT: "0123456789abcdef0123456789abcdef01234567",
  NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_uat",
}

const safeProductionWriteEnvironment = {
  MFMS_ENV: "production",
  NEXT_PUBLIC_MFMS_ENV: "production",
  MFMS_ENABLE_LOCAL_WRITE_GUARD: "true",
  MFMS_TARGET_DATABASE: "mfms_server_prod",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_prod",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api",
  MFMS_LOCAL_WRITE_BACKEND_PORT: "8000",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api",
  MFMS_ALLOWED_BACKEND_PORT: "8000",
  MFMS_BUILD_ENVIRONMENT: "Production",
  MFMS_GIT_COMMIT: "89abcdef0123456789abcdef0123456789abcdef",
  NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_prod",
}

const gate = ({
  explicitFlagValue,
  targetSafetyErrors = [],
  sourceProductionApproval = COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL,
  runtime = safePreviewWriteEnvironment,
} = {}) => isHarvestCycleWriteAllowed({
  explicitFlagValue,
  targetSafetyErrors,
  sourceProductionApproval,
  runtime,
})

test("workbook table has Cycle selector and exactly twelve Excel columns", () => {
  const tableHead = component.slice(component.indexOf("<thead>"), component.indexOf("</thead>"))
  const headings = [...tableHead.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, "").trim(),
  )
  assert.deepEqual(headings, [
    "Plot",
    "Harvest date",
    "Status",
    "Entries",
    "Grade A",
    "Grade B",
    "Count B",
    "Combined",
    "Physical",
    "Rejection",
    "Harvested",
    "Last sync",
  ])
  assert.doesNotMatch(tableHead, />Cycle</)
  assert.match(component, /<select[\s\S]*value=\{selectedCycle \?\? ""\}/)
  assert.match(component, /cycleOptions\.map\(\(cycle\) =>/)
})

test("selected Cycle drives an exact reconciliation request and complete-cycle rows", () => {
  assert.match(component, /requestReconciliation\(\s*`\/api\/coconut-counting\/reconciliation\?cycle=\$\{cycle\}`/)
  assert.match(component, /data\?\.cycles\.find\(\(cycle\) => cycle\.harvest_cycle === selectedCycle\) \?\? null/)
  assert.match(component, /cycleData\.plots\.map/)
  assert.match(component, /plotSessions\(cycleData, summary\.plot\)\.map/)
  assert.doesNotMatch(component, /CoconutCountingDashboardData|dashboard\.sessions|data\.sessions/)
  assert.match(readRoute, /getCoconutCountingReconciliation\(requestedCycle \?\? undefined\)/)
  assert.match(serverApi, /target\.searchParams\.set\("harvest_cycle"/)
  assert.doesNotMatch(component, /Cycle 20|harvest_cycle === 20|cycle === 20/)
})

test("server state deterministically initializes ready, empty and error views", () => {
  const readyData = {
    cycles: [{ harvest_cycle: 21 }, { harvest_cycle: 20 }],
    unassigned_session_count: 0,
  }
  const readyResult = reconciliationDataResult(readyData)
  assert.deepEqual(readyResult, { status: "ready", data: readyData })
  const ready = reconciliationInitialState(readyResult)
  assert.deepEqual(ready, {
    data: readyData,
    cycleOptions: [21, 20],
    selectedCycle: 21,
    status: "ready",
    error: "",
  })

  const emptyData = { cycles: [], unassigned_session_count: 5 }
  const emptyResult = reconciliationDataResult(emptyData)
  assert.deepEqual(emptyResult, { status: "empty", data: emptyData })
  const empty = reconciliationInitialState(emptyResult)
  assert.deepEqual(empty, {
    data: emptyData,
    cycleOptions: [],
    selectedCycle: null,
    status: "empty",
    error: "",
  })

  const failed = reconciliationInitialState({ status: "error", error: "Reconciliation unavailable." })
  assert.deepEqual(failed, {
    data: null,
    cycleOptions: [],
    selectedCycle: null,
    status: "error",
    error: "Reconciliation unavailable.",
  })
})

test("server initial data and bounded refresh requests prevent an indefinite loading view", () => {
  assert.match(serverApi, /^import "server-only"/)
  assert.match(serverApi, /getApiBaseUrl\(\)/)
  assert.match(serverApi, /getBasicAuthHeader\(\)/)
  assert.match(serverApi, /api\/coconut-counting\/reconciliation/)
  assert.match(serverApi, /signal: AbortSignal\.timeout\(RECONCILIATION_TIMEOUT_MS\)/)
  assert.match(serverApi, /RECONCILIATION_TIMEOUT_MS = 15_000/)
  assert.match(page, /getCoconutCountingReconciliation\(\)\.then\(/)
  assert.match(page, /initialResult=\{reconciliation\}/)
  assert.match(component, /reconciliationInitialState\(initialResult\)/)
  assert.doesNotMatch(component, /void discoverCycles\(null\)/)
  assert.match(component, /createRequestAbortScope\(RECONCILIATION_REQUEST_TIMEOUT_MS, workflowSignal\)/)
  assert.match(component, /signal: abortScope\.signal/)
  assert.match(component, /RECONCILIATION_REQUEST_TIMEOUT_MS = 15_000/)
  assert.match(component, /requestController\.current\?\.abort\(\)/)
  assert.match(component, /const \{ controller, requestId \} = beginRequest\(\)/)
  assert.match(component, /if \(requestId !== requestGeneration\.current\) return/)
  assert.match(component, /No Cycle\/Plot APK records are available\./)
  assert.match(component, /data\.unassigned_session_count\.toLocaleString/)
  assert.match(editor, /createRequestAbortScope\(HARVESTED_SAVE_TIMEOUT_MS\)/)
  assert.match(editor, /signal: abortScope\.signal/)
  assert.match(editor, /HARVESTED_SAVE_TIMEOUT_MS = 15_000/)
  assert.match(editor, /Saving Harvested timed out after 15 seconds/)
  assert.match(editor, /save outcome may be unknown; Refresh the harvest table before retrying/)
  assert.doesNotMatch(editor, /Please try again/)
  assert.match(writeRoute, /save outcome may be unknown; Refresh the harvest table before retrying/)
  assert.match(readRoute, /getCoconutCountingReconciliation\(requestedCycle \?\? undefined\)/)
  assert.doesNotMatch(readRoute, /getApiBaseUrl|getBasicAuthHeader/)
})

test("client requests compose cancellation and timeouts without newer AbortSignal APIs", async () => {
  const waitForTimers = () => new Promise((resolve) => setTimeout(resolve, 10))

  assert.doesNotMatch(component, /AbortSignal\.(?:any|timeout)\(/)
  assert.doesNotMatch(editor, /AbortSignal\.(?:any|timeout)\(/)
  assert.match(reconciliationLibrary, /new AbortController\(\)/)
  assert.match(reconciliationLibrary, /workflowSignal\.addEventListener\("abort", abortFromWorkflow/)
  assert.match(reconciliationLibrary, /workflowSignal\.removeEventListener\("abort", abortFromWorkflow\)/)
  assert.match(reconciliationLibrary, /clearTimeout\(timeoutId\)/)

  const workflowController = new AbortController()
  const cancelledScope = createRequestAbortScope(1, workflowController.signal)
  workflowController.abort()
  await waitForTimers()
  assert.equal(cancelledScope.signal.aborted, true)
  assert.equal(cancelledScope.didTimeout(), false)
  cancelledScope.cleanup()

  const timedScope = createRequestAbortScope(1)
  await waitForTimers()
  assert.equal(timedScope.signal.aborted, true)
  assert.equal(timedScope.didTimeout(), true)
  timedScope.cleanup()

  let addedListener = null
  let removedListener = null
  const observedWorkflowSignal = {
    aborted: false,
    addEventListener(event, listener) {
      assert.equal(event, "abort")
      addedListener = listener
    },
    removeEventListener(event, listener) {
      assert.equal(event, "abort")
      removedListener = listener
    },
  }
  const cleanedScope = createRequestAbortScope(1, observedWorkflowSignal)
  cleanedScope.cleanup()
  await waitForTimers()
  assert.equal(removedListener, addedListener)
  assert.equal(cleanedScope.signal.aborted, false)
})

test("Excel formulas, blank subtotal Entries and percentages are explicit", () => {
  assert.deepEqual(calculateWorkbookValues(1083, 430), {
    gradeA: 1083,
    countB: 430,
    gradeB: 860,
    combined: 1513,
    physical: 1943,
  })
  assert.equal(formatReconciliationNumber(10802), "10,802")
  assert.equal(formatReconciliationPercent(55.59155711905203), "56%")
  assert.match(component, /Grade B = Count B × 2/)
  assert.match(component, /Combined = Grade A \+ Count B/)
  assert.match(component, /Physical = Grade A \+ Grade B/)
  assert.match(component, /Rejection = Harvested − Physical/)
  assert.match(component, /<th scope="row"[^>]*>Total \{summary\.plot\}<\/th>[\s\S]*?<td[^>]*> <\/td>/)
  assert.match(component, /<th scope="row"[^>]*>Percentage<\/th>[\s\S]*?colSpan=\{3\}[^>]*> <\/td>/)
  assert.doesNotMatch(component, /summary\.last_sync/)
  assert.match(component, /hour12: true/)
})

test("manual Harvested is Cycle/Plot scoped, audited and collision-safe", () => {
  assert.match(editor, /expected_revision: summary\.harvested_revision/)
  assert.match(editor, /summary\.harvested_revision > 0/)
  assert.match(editor, /Reason for correction/)
  assert.match(editor, /idPrefix/)
  assert.match(component, /idPrefix="mobile"/)
  assert.match(component, /idPrefix="desktop"/)
  assert.match(writeRoute, /getAdminTargetSafetyErrors/)
  assert.match(writeRoute, /getAuthenticatedUserAssertionHeaders/)
  assert.match(writeRoute, /MFMS_HARVEST_CYCLE_WRITES_ENABLED/)
  assert.match(writeRoute, /COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL/)
  assert.match(writeRoute, /MFMS_BUILD_ENVIRONMENT/)
  assert.match(writeRoute, /MFMS_GIT_COMMIT/)
  assert.doesNotMatch(writeRoute, /MFMS_ENABLE_PREVIEW_HARVEST_CYCLE_WRITES/)
  assert.match(writeRoute, /expectedRevision > 0 && !reason/)
})

test("a completed save cannot replace a newer Cycle selection", () => {
  assert.match(component, /const selectedCycleRef = useRef\(initialState\.selectedCycle\)/)
  assert.match(component, /selectedCycleRef\.current = cycle[\s\S]*?setSelectedCycle\(cycle\)[\s\S]*?loadCycle\(cycle\)/)
  assert.match(component, /if \(selectedCycleRef\.current !== savedCycle\) return Promise\.resolve\(\)/)
  assert.match(component, /onReload=\{\(\) => reloadSavedCycle\(cycleData\.harvest_cycle\)\}/)
  assert.match(component, /onSaved=\{\(\) => reloadSavedCycle\(cycleData\.harvest_cycle\)\}/)
})

test("manual Harvested rollout gate permits only exact Preview or UAT release identities", () => {
  const safeTargetErrors = getAdminTargetSafetyErrors(
    safePreviewWriteEnvironment,
    "http://harvest-api-pilot:8000",
  )
  assert.deepEqual(safeTargetErrors, [])
  assert.equal(gate({ targetSafetyErrors: safeTargetErrors }), true)
  assert.equal(gate({ explicitFlagValue: "true", targetSafetyErrors: safeTargetErrors }), true)
  assert.equal(gate({ explicitFlagValue: " TRUE ", targetSafetyErrors: safeTargetErrors }), true)

  const safeUatRuntime = {
    ...safePreviewWriteEnvironment,
    MFMS_ENV: "uat",
    NEXT_PUBLIC_MFMS_ENV: "uat",
  }
  const safeUatErrors = getAdminTargetSafetyErrors(safeUatRuntime, "http://harvest-api-pilot:8000")
  assert.deepEqual(safeUatErrors, [])
  assert.equal(gate({ runtime: safeUatRuntime, targetSafetyErrors: safeUatErrors }), true)

  for (const explicitKillSwitch of ["false", "enabled", "1", ""]) {
    assert.equal(gate({ explicitFlagValue: explicitKillSwitch, targetSafetyErrors: safeTargetErrors }), false)
  }

  const unsafeTargetErrors = getAdminTargetSafetyErrors(
    { ...safePreviewWriteEnvironment, MFMS_LOCAL_WRITE_DATABASE: "mfms_server_prod" },
    "http://harvest-api-pilot:8000",
  )
  assert.ok(unsafeTargetErrors.length > 0)
  assert.equal(gate({ targetSafetyErrors: unsafeTargetErrors }), false)
  assert.equal(gate({ explicitFlagValue: "true", targetSafetyErrors: unsafeTargetErrors }), false)

  const unsafePreviewRuntimeVariants = [
    { MFMS_BUILD_ENVIRONMENT: "Production" },
    { MFMS_BUILD_ENVIRONMENT: "preview" },
    { MFMS_GIT_COMMIT: undefined },
    { MFMS_GIT_COMMIT: "0123456" },
    { MFMS_GIT_COMMIT: "0123456789ABCDEF0123456789ABCDEF01234567" },
    { NEXT_PUBLIC_MFMS_ENV: "uat" },
    { NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_prod" },
  ]
  for (const variant of unsafePreviewRuntimeVariants) {
    assert.equal(gate({ runtime: { ...safePreviewWriteEnvironment, ...variant } }), false)
  }
  assert.equal(gate({
    runtime: {
      ...safePreviewWriteEnvironment,
      NEXT_PUBLIC_MFMS_ENV: undefined,
      NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: undefined,
    },
  }), true)
})

test("Production Harvested writes require source approval and exact Production identity", () => {
  const safeProductionErrors = getAdminTargetSafetyErrors(
    safeProductionWriteEnvironment,
    "http://harvest-api:8000",
  )
  assert.deepEqual(safeProductionErrors, [])
  assert.equal(
    COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL,
    "PREVIEW_SOURCE_POLICY__PRODUCTION_HARVESTED_WRITES_DISABLED",
  )

  // Neither an absent flag nor an explicit true can override Preview's
  // source-controlled Production-disabled policy.
  assert.equal(gate({ runtime: safeProductionWriteEnvironment, targetSafetyErrors: safeProductionErrors }), false)
  assert.equal(gate({
    explicitFlagValue: "true",
    runtime: safeProductionWriteEnvironment,
    targetSafetyErrors: safeProductionErrors,
  }), false)

  const approvedProduction = {
    runtime: safeProductionWriteEnvironment,
    targetSafetyErrors: safeProductionErrors,
    sourceProductionApproval: REQUIRED_PRODUCTION_WRITE_APPROVAL,
  }
  assert.equal(gate(approvedProduction), true)
  assert.equal(gate({ ...approvedProduction, explicitFlagValue: "true" }), true)
  assert.equal(gate({
    ...approvedProduction,
    runtime: {
      ...safeProductionWriteEnvironment,
      NEXT_PUBLIC_MFMS_ENV: undefined,
      NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: undefined,
    },
  }), true)

  for (const explicitKillSwitch of ["false", "enabled", "1", ""]) {
    assert.equal(gate({ ...approvedProduction, explicitFlagValue: explicitKillSwitch }), false)
  }

  const unsafeProductionRuntimeVariants = [
    { MFMS_ENV: "prod" },
    { NEXT_PUBLIC_MFMS_ENV: "prod" },
    { MFMS_BUILD_ENVIRONMENT: "Preview" },
    { MFMS_BUILD_ENVIRONMENT: "production" },
    { MFMS_GIT_COMMIT: undefined },
    { MFMS_GIT_COMMIT: "89abcdef0123456789abcdef0123456789abcde" },
    { MFMS_GIT_COMMIT: "89ABCDEF0123456789ABCDEF0123456789ABCDEF" },
    { NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_uat" },
  ]
  for (const variant of unsafeProductionRuntimeVariants) {
    assert.equal(gate({
      ...approvedProduction,
      runtime: { ...safeProductionWriteEnvironment, ...variant },
    }), false)
  }

  assert.equal(gate({
    ...approvedProduction,
    sourceProductionApproval: `${REQUIRED_PRODUCTION_WRITE_APPROVAL} `,
  }), false)
  assert.equal(gate({
    ...approvedProduction,
    targetSafetyErrors: ["target mismatch"],
  }), false)
  assert.equal(gate({
    ...approvedProduction,
    runtime: {
      ...safePreviewWriteEnvironment,
      MFMS_ENV: "test",
      NEXT_PUBLIC_MFMS_ENV: "test",
      NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_test",
    },
  }), false)
})

test("filtered session history remains separate and Cycle View remains restored", () => {
  assert.ok(page.indexOf("<CoconutCountingReconciliationTable") < page.indexOf("<FilterForm filters={filters} />"))
  assert.match(page, /filters apply only to the session summary and detail records below/)
  assert.match(page, /<SessionTable data=\{dashboard\} filters=\{filters\} \/>/)
  assert.match(page, /<SessionDetail detail=\{detail\} \/>/)
  assert.match(page, /CoconutCountingSessionControls/)
  assert.match(cycleView, /plotRows\?\.map/)
  assert.match(harvestApi, /fetchCyclePlotSourceRows/)
  assert.match(harvestApi, /applyCyclePlotBreakdown/)
  assert.doesNotMatch(cycleView, /CoconutCountingReconciliationTable/)
})
