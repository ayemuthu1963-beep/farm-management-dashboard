import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { NextRequest, NextResponse } from "next/server.js"
import * as api from "../lib/api.ts"
import * as identity from "../lib/mfms-admin-identity.ts"
import { isNavigationItemActive, mfmsNavigationItems, sidebarNavigationItems } from "../lib/mfms-navigation.ts"

// Execute the actual route with the real Next request/response and shared signing
// helpers; only network IO is replaced. No live credentials or service are used.
const require = createRequire(import.meta.url)
const ts = require("typescript")
const source = readFileSync(new URL("../app/api/intelligence/ask/route.ts", import.meta.url), "utf8")
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const compiled = { exports: {} }
const routeRequire = (specifier) => {
  if (specifier === "next/server") return { NextRequest, NextResponse }
  if (specifier === "@/lib/api") return api
  if (specifier === "@/lib/mfms-admin-identity") return identity
  throw new Error(`Unexpected Intelligence dependency: ${specifier}`)
}
Function("require", "module", "exports", output)(routeRequire, compiled, compiled.exports)
const { POST } = compiled.exports
const environmentKeys = ["MFMS_ENV", "MFMS_TARGET_DATABASE", "NEXT_PUBLIC_MFMS_ENV", "NEXT_PUBLIC_MFMS_TARGET_DATABASE", "NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL", "MFMS_TRUST_PROXY_ACTOR_HEADERS", "HARVEST_API_BASE_URL", "HARVEST_API_USERNAME", "HARVEST_API_PASSWORD"]
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]))
const originalFetch = globalThis.fetch
const originalTimeout = AbortSignal.timeout
const signingSecret = "intelligence-test-signing-secret-only"
const validResponse = {
  answer: "302302 coconuts across 19760 harvested tree-cycle records.", status: "ANSWERED",
  data_as_of: "2026-09-09T07:45:33Z", period: "Latest 10 completed harvest cycles", period_start: "2025-01-01", period_end: "2026-08-04",
  cycles: ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19"], denominator: "19760 harvested tree-cycle records",
  quality_flags: [], data_source_status: "VERIFIED_ANALYTICS", analysis_plan: null, table: null, chart: null,
  blocked_reason: null, metabase_call_made: true, provider_call_made: false,
}
let requests = []
let timeoutCalls = []
let upstream = validResponse
let upstreamStatus = 200
let cases = 0
function configure(overrides = {}) {
  for (const key of environmentKeys) delete process.env[key]
  Object.assign(process.env, {
    MFMS_ENV: "production", MFMS_TARGET_DATABASE: "mfms_server_prod",
    NEXT_PUBLIC_MFMS_ENV: "production", NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_prod",
    MFMS_TRUST_PROXY_ACTOR_HEADERS: "true", HARVEST_API_BASE_URL: "http://harvest-api:8000",
    HARVEST_API_USERNAME: "test-backend", HARVEST_API_PASSWORD: signingSecret,
    ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
  })
  for (const [key, value] of Object.entries(overrides)) if (value === undefined) delete process.env[key]
  requests = []; timeoutCalls = []; upstream = structuredClone(validResponse); upstreamStatus = 200
  globalThis.fetch = async (target, init) => {
    requests.push({ target: String(target), init })
    return Response.json(upstream, { status: upstreamStatus })
  }
  AbortSignal.timeout = (milliseconds) => { timeoutCalls.push(milliseconds); return originalTimeout(milliseconds) }
}
async function ask({ body = JSON.stringify({ question: " Latest ten completed harvest cycles " }), headers = {}, authenticated = true } = {}) {
  return POST(new NextRequest("https://muthufarms.com/api/intelligence/ask", {
    method: "POST", body, headers: { "content-type": "application/json", ...(authenticated ? { "x-mfms-user": "verified-owner" } : {}), ...headers },
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  }))
}
async function rejected(expectedStatus, options) {
  const response = await ask(options)
  assert.equal(response.status, expectedStatus)
  assert.equal(requests.length, 0, "Rejected request must never reach the backend")
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0")
  const data = await response.json()
  assert.equal(data.metabase_call_made, false)
  assert.equal(data.provider_call_made, false)
  assert.equal(data.data_source_status, "NOT_QUERIED_FAIL_CLOSED")
  assert.ok(!JSON.stringify(data).includes(signingSecret))
  cases++
}
try {
  for (const [environment, database, backend] of [["production", "mfms_server_prod", "harvest-api"], ["preview", "mfms_server_uat", "harvest-api-pilot"], ["uat", "mfms_server_uat", "harvest-api-pilot"]]) {
    configure({ MFMS_ENV: environment, MFMS_TARGET_DATABASE: database, NEXT_PUBLIC_MFMS_ENV: environment, NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: database, HARVEST_API_BASE_URL: `http://${backend}:8000` })
    const result = await ask()
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), validResponse)
    assert.equal(requests.length, 1)
    const { target, init } = requests[0]
    assert.equal(target, `http://${backend}:8000/api/intelligence/ask`)
    assert.equal(init.body, JSON.stringify({ question: "Latest ten completed harvest cycles" }))
    assert.equal(init.cache, "no-store")
    assert.equal(init.redirect, "error", "Signed actor headers must never be forwarded through redirects")
    assert.deepEqual(timeoutCalls, [20_000])
    assert.equal(init.headers.Authorization, `Basic ${Buffer.from(`test-backend:${signingSecret}`).toString("base64")}`)
    const timestamp = init.headers["X-MFMS-Authenticated-User-Timestamp"]
    assert.match(timestamp, /^\d+$/)
    assert.equal(init.headers["X-MFMS-Authenticated-User"], "verified-owner")
    assert.equal(init.headers["X-MFMS-Authenticated-User-Signature"], createHmac("sha256", signingSecret).update([timestamp, "POST", "/api/intelligence/ask", "verified-owner"].join("\n")).digest("hex"))
    assert.ok(!JSON.stringify(init.headers).includes("mfms-preview-backend"), "Private identity is owned by the environment-validated backend")
    assert.equal(result.headers.get("cache-control"), "no-store, max-age=0")
    cases++
  }
  for (const overrides of [
    { MFMS_ENV: undefined }, { MFMS_ENV: "local" }, { MFMS_ENV: "development" }, { MFMS_ENV: "test" }, { MFMS_ENV: "prod" }, { MFMS_ENV: "unknown" },
    { MFMS_TARGET_DATABASE: undefined }, { MFMS_TARGET_DATABASE: "mfms_server_uat" }, { MFMS_TARGET_DATABASE: "mfms_server_prod_candidate" },
    { MFMS_ENV: "preview", NEXT_PUBLIC_MFMS_ENV: "preview" }, { MFMS_ENV: "uat", NEXT_PUBLIC_MFMS_ENV: "uat" },
    { NEXT_PUBLIC_MFMS_ENV: "preview" }, { NEXT_PUBLIC_MFMS_ENV: "unknown" }, { NEXT_PUBLIC_MFMS_TARGET_DATABASE: "mfms_server_uat" },
    { NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_uat" },
  ]) { configure(overrides); await rejected(403) }
  for (const target of [undefined, "", "http://127.0.0.1:8001", "http://harvest-api-pilot:8000", "https://harvest-api:8000", "http://harvest-api:8001", "http://harvest-api:8000/path", "http://harvest-api:8000?next=other", "http://harvest-api:8000#other", "http://user:password@harvest-api:8000", "http://harvest-api:8000//", "http://harvest-api:8000.evil.invalid"]) {
    configure({ HARVEST_API_BASE_URL: target }); await rejected(403)
  }
  configure({ MFMS_ENV: "preview", MFMS_TARGET_DATABASE: "mfms_server_uat", NEXT_PUBLIC_MFMS_ENV: "preview", NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL: "mfms_server_uat", HARVEST_API_BASE_URL: "http://harvest-api:8000" }); await rejected(403)
  configure({ HARVEST_API_BASE_URL: "http://harvest-api:8000/" })
  assert.equal((await ask()).status, 200); assert.equal(requests[0].target, "http://harvest-api:8000/api/intelligence/ask"); cases++
  configure(); await rejected(401, { authenticated: false })
  configure(); await rejected(401, { authenticated: false, headers: { authorization: `Basic ${Buffer.from("spoof:password").toString("base64")}` } })
  configure({ MFMS_TRUST_PROXY_ACTOR_HEADERS: "false" }); await rejected(503)
  configure({ HARVEST_API_PASSWORD: undefined }); await rejected(503)
  configure(); await rejected(401, { headers: { "x-mfms-user": "x".repeat(129) } })
  for (const body of ["{", "null", "[]", "{}", '{"question":42}', '{"question":"hello","service_id":"mfms-production-backend"}', '{"question":"hello","sql":"SELECT 1"}']) {
    configure(); await rejected(400, { body })
  }
  for (const question of ["   ", "x".repeat(501)]) { configure(); await rejected(422, { body: JSON.stringify({ question }) }) }
  for (const length of ["4097", "-1", "invalid", "1.5"]) { configure(); await rejected(413, { headers: { "content-length": length } }) }
  for (const headers of [{}, { "content-length": "1" }]) {
    configure(); await rejected(413, { headers, body: JSON.stringify({ question: "x".repeat(5000) }) })
  }
  configure()
  let cancelled = false
  const chunks = [new TextEncoder().encode('{"question":"'), new TextEncoder().encode("x".repeat(4096))]
  const stream = new ReadableStream({ pull(controller) { if (chunks.length) controller.enqueue(chunks.shift()); else controller.enqueue(new Uint8Array(1)) }, cancel() { cancelled = true } })
  await rejected(413, { body: stream }); assert.equal(cancelled, true)
  for (const mutate of [
    (data) => { data.secret = signingSecret }, (data) => { delete data.provider_call_made }, (data) => { data.status = "SUCCESS" },
    (data) => { data.cycles = ["20; SELECT"] }, (data) => { data.analysis_plan = { sql: "SELECT 1" } },
    (data) => { data.table = { title: "Unsafe", columns: [{ key: "password", label: "Password", format: "text" }], rows: [] } },
    (data) => { data.table = { title: "Too many rows", columns: [{ key: "tree_no", label: "Tree", format: "text" }], rows: Array.from({ length: 51 }, () => ({ tree_no: "351" })) } },
    (data) => { data.chart = { type: "javascript", data: [] } }, (data) => { data.export_context = { context_id: "unverified" } },
  ]) {
    configure(); mutate(upstream)
    const response = await ask(); assert.equal(response.status, 502)
    assert.ok(!JSON.stringify(await response.json()).includes(signingSecret)); cases++
  }

  const exportRows = [
    { tree_no: "35.1", total_nuts: 532, quality_flags: ["VERIFIED"], average_nuts_per_harvested_record: null },
    { tree_no: "351", total_nuts: 610, quality_flags: [], average_nuts_per_harvested_record: "61.000000" },
  ]
  const tableColumns = [{ key: "tree_no", label: "Tree", format: "text" }, { key: "total_nuts", label: "Nuts", format: "integer" }, { key: "quality_flags", label: "Quality", format: "flags" }]
  const availableColumns = [...tableColumns, { key: "average_nuts_per_harvested_record", label: "Average", format: "decimal6" }].map((column) => ({ ...column, category: "Core", required: false, default_selected: column.key !== "average_nuts_per_harvested_record" }))
  const exportResponse = {
    ...validResponse,
    table: { title: "Snapshot", columns: tableColumns, rows: [{ tree_no: "35.1", total_nuts: 532, quality_flags: ["VERIFIED"] }] },
    export_context: {
      version: "MFMS_INTELLIGENCE_EXPORT_CONTEXT_V1", context_id: "a".repeat(64), question: "Verified trees", answer_type: "Trees", filename_stem: "Trees",
      warehouse_refresh_id: "MFMS_REFRESH_TEST", harvest_data_as_of: "2026-08-04", lifecycle_as_of_date: null, selected_cycles: ["19"],
      all_matching_row_count: 2, displayed_row_count: 1, available_columns: availableColumns, default_columns: tableColumns.map((column) => column.key), rows: exportRows,
      verification: Object.fromEntries(["applied_filters", "complete_history_denominator", "denominator", "direction_rule", "duplicate_tree_1112_policy", "incomplete_history_exclusions", "lifecycle_filter", "period", "period_end", "period_start", "precision_policy", "quality_policy"].map((key) => [key, null])),
    },
  }
  configure(); upstream = structuredClone(exportResponse)
  assert.equal((await ask()).status, 200, "Export may contain additional columns and undisplayed rows"); cases++
  configure(); upstream = structuredClone(exportResponse); upstream.export_context.available_columns.reverse()
  upstream.export_context.rows = upstream.export_context.rows.map((row) => Object.fromEntries(upstream.export_context.available_columns.map((column) => [column.key, row[column.key]])))
  const reorderedDefaults = structuredClone(upstream.export_context.default_columns)
  const reorderedResponse = await ask(); assert.equal(reorderedResponse.status, 200)
  assert.deepEqual((await reorderedResponse.json()).export_context.default_columns, reorderedDefaults, "Selected column order is preserved independently of available-column category order"); cases++
  for (const mutate of [
    (data) => { data.export_context.default_columns.reverse() },
    (data) => { data.export_context.default_columns.push(data.export_context.default_columns[0]) },
    (data) => { data.export_context.default_columns.pop() },
    (data) => { data.export_context.default_columns.push("average_nuts_per_harvested_record") },
    (data) => { data.table.rows[0].total_nuts = 1 },
    (data) => { data.table.rows[0].tree_no = "351" },
    (data) => { data.table.rows[0].quality_flags = ["UNMATCHED"] },
    (data) => { data.export_context.rows.reverse() },
    (data) => { data.export_context.rows[0].total_nuts = 1 },
    (data) => { data.table.columns[1].format = "text"; data.table.rows[0].total_nuts = "532" },
    (data) => { data.table.columns.push({ key: "plot", label: "Plot", format: "text" }); data.table.rows[0].plot = "Plot 1" },
    (data) => { data.table.rows.push({ ...data.table.rows[0] }, { ...data.table.rows[0] }); data.export_context.displayed_row_count = 3 },
  ]) {
    configure(); upstream = structuredClone(exportResponse); mutate(upstream)
    assert.equal((await ask()).status, 502, "Displayed rows must equal the leading export projection"); cases++
  }
  const irrigationPlan = { domain: "irrigation", metric: "runtime_minutes", group_by: "none", filters: { zones: [], motors: [], wells: [] }, period: { kind: "current_month", count: null, start: null, end: null }, sort: { direction: "asc" }, limit: null, chart_type: null }
  const wellPlan = { domain: "well_water", metric: "calibrated_litres", group_by: "well", filters: { wells: [], reading_period: null, quality_filter: null }, period: { kind: "current_month", count: null, start: null, end: null }, sort: { direction: "asc" }, limit: null, chart_type: null }
  const compositeResponse = { ...validResponse,
    analysis_plan: { kind: "composite", domains: ["irrigation", "well_water"], period: { kind: "domain_default", start: null, end: null, count: null }, presentation: "domain_cards", execution: "independent_validated_domain_subplans", subplans: [irrigationPlan, wellPlan] },
    sections: ["irrigation", "well_water"].map((domain) => ({ domain, title: domain, headline: "Verified", period: null, data_as_of: "2026-09-09", denominator: null, quality_flags: [], data_source_status: "VERIFIED_ANALYTICS", table: null, chart: null })), charts: [],
    freshness: { domains: { irrigation: "2026-09-09", well_water: "2026-09-09" }, oldest_source_refresh: "2026-09-09", oldest_source_domain: "irrigation", quality_flags: [] },
  }
  configure(); upstream = structuredClone(compositeResponse); assert.equal((await ask()).status, 200); cases++
  for (const mutate of [
    (data) => { data.analysis_plan = null },
    (data) => { data.analysis_plan.domains.reverse(); data.analysis_plan.subplans.reverse() },
    (data) => { data.sections.reverse(); data.freshness.domains = { well_water: "2026-09-09", irrigation: "2026-09-09" } },
    (data) => { data.sections[0].domain = "beetle_monitoring"; data.freshness.domains = { beetle_monitoring: "2026-09-09", well_water: "2026-09-09" }; data.freshness.oldest_source_domain = "beetle_monitoring" },
  ]) {
    configure(); upstream = structuredClone(compositeResponse); mutate(upstream)
    assert.equal((await ask()).status, 502, "Composite result domains must match the validated plan in order"); cases++
  }

  for (const status of ["BLOCKED_GOVERNANCE", "BLOCKED_SECURITY", "BLOCKED_NOT_YET_SUPPORTED", "BLOCKED_LIMIT"]) {
    configure(); upstream = { ...upstream, answer: "", status, blocked_reason: "Governed boundary", metabase_call_made: false, provider_call_made: false }
    upstreamStatus = status === "BLOCKED_LIMIT" ? 429 : 200
    const response = await ask({ body: JSON.stringify({ question: "Recommend a treatment" }) })
    assert.equal(response.status, upstreamStatus); assert.equal((await response.json()).status, status); cases++
  }
  configure(); globalThis.fetch = async () => Response.json({ detail: signingSecret }, { status: 401 })
  assert.equal((await ask()).status, 502); cases++
  configure(); globalThis.fetch = async () => { throw new Error(signingSecret) }
  const unavailable = await ask(); assert.equal(unavailable.status, 503); assert.ok(!(await unavailable.text()).includes(signingSecret)); cases++
  configure(); globalThis.fetch = async () => new Response("not JSON", { status: 500 })
  assert.equal((await ask()).status, 502); cases++
  if (process.env.MFMS_INTELLIGENCE_RESPONSE_FIXTURE) {
    const fixture = JSON.parse(readFileSync(process.env.MFMS_INTELLIGENCE_RESPONSE_FIXTURE, "utf8"))
    for (const response of Array.isArray(fixture) ? fixture : [fixture]) {
      configure(); upstream = response
      assert.equal((await ask()).status, 200, "The supplied private-service compatibility response must pass the real frontend route"); cases++
    }
  }
  const entry = mfmsNavigationItems.find((item) => item.id === "mfms-intelligence")
  assert.ok(entry); assert.equal(entry.href, "/intelligence"); assert.equal(entry.status, "active")
  assert.equal(sidebarNavigationItems.filter((item) => item.id === entry.id).length, 1)
  assert.equal(isNavigationItemActive("/intelligence", entry), true)
  assert.equal(isNavigationItemActive("/intelligence-extra", entry), false)
  for (const path of ["app/intelligence/page.tsx", "components/intelligence/intelligence-client.tsx"]) assert.doesNotMatch(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), /\b(?:preview|uat)\b/i)
  cases++
  console.log(`MFMS Intelligence route, authentication, validation and navigation: ${cases} cases PASS`)
} finally {
  globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout
  for (const [key, value] of Object.entries(originalEnvironment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
}
