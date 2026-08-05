import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const page = readFileSync(new URL("../app/coconut-counting/page.tsx", import.meta.url), "utf8")
const refresh = readFileSync(new URL("../components/coconut-counting/refresh-controls.tsx", import.meta.url), "utf8")
const adminPage = readFileSync(new URL("../app/admin/coconut-counting/page.tsx", import.meta.url), "utf8")
const adminClient = readFileSync(new URL("../components/admin/coconut-counting-admin-client.tsx", import.meta.url), "utf8")
const adminProxy = readFileSync(new URL("../lib/coconut-counting-admin-proxy.ts", import.meta.url), "utf8")
const previewNotice = readFileSync(new URL("../components/admin/preview-admin-notice.tsx", import.meta.url), "utf8")

test("Coconut Counting webpage exposes A1 B1 B2 and the protected Admin Edit tile", () => {
  for (const label of ["A1", "B1", "B2"]) assert.match(page, new RegExp(`label="${label}"`))
  assert.match(page, /Admin Edit/)
  assert.match(page, /same From and To date/)
})

test("Coconut Counting webpage auto refresh is exactly thirty minutes with a manual control", () => {
  assert.match(refresh, /30 \* 60_000/)
  assert.match(refresh, /SYNC NOW/)
  assert.match(refresh, /router\.refresh\(\)/)
})

test("Admin Edit protects technical fields and presents session entry and audit editors", () => {
  assert.match(adminPage, /Technical IDs and server audit records remain read-only/)
  assert.match(adminClient, /Edit selected session/)
  assert.match(adminClient, /Edit count entries/)
  assert.match(adminClient, /Admin edit audit history/)
  assert.doesNotMatch(adminClient, /name="session_uuid"/)
  assert.doesNotMatch(adminClient, /name="entry_uuid"/)
})

test("Admin write proxy is Preview-only authenticated signed and target-restricted", () => {
  assert.match(adminProxy, /restricted to Preview\/UAT/)
  assert.match(adminProxy, /Preview authentication is required/)
  assert.match(adminProxy, /createHmac/)
  assert.match(adminProxy, /timingSafeEqual/)
  assert.match(adminProxy, /PREVIEW_BACKEND_HOSTS/)
  assert.match(adminProxy, /Cross-site admin edits are not allowed/)
})

test("Preview safety banner recognizes the approved Vercel Preview UAT target", () => {
  assert.match(previewNotice, /VERCEL_ENV === "preview"/)
  assert.match(previewNotice, /preview\.muthufarms\.com/)
  assert.match(previewNotice, /mfms_server_uat/)
  assert.match(previewNotice, /DATABASE NOT CONFIGURED/)
})
