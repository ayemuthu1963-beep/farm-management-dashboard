import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"

import { getAuthenticatedUserAssertionHeaders } from "../lib/mfms-admin-identity.ts"

const route = readFileSync(
  "app/api/coconut-counting/sessions/[sessionUuid]/close/route.ts",
  "utf8",
)
const page = readFileSync("app/coconut-counting/page.tsx", "utf8")
const controls = readFileSync("components/coconut-counting/session-controls.tsx", "utf8")

assert.match(route, /export async function POST/)
assert.match(route, /getAdminTargetSafetyErrors\(process\.env, apiBaseUrl\)/)
assert.match(route, /getAuthenticatedUserAssertionHeaders/)
assert.match(route, /requestHeaders: request\.headers/)
assert.match(route, /method: "POST"/)
assert.match(route, /Authorization: serviceAuthorization/)
assert.match(route, /\.\.\.actorHeaders/)
assert.match(route, /AbortSignal\.timeout\(30_000\)/)
assert.doesNotMatch(route, /NEXT_PUBLIC_[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN)/)
assert.doesNotMatch(controls, /HARVEST_API_PASSWORD|MFMS_ACTOR_ASSERTION_SECRET/)

assert.match(page, /CoconutCountingSessionControls/)
assert.match(page, /isActive=\{session\.status === "ACTIVE"\}/)
assert.match(controls, /Close Session/)
assert.match(controls, /role="dialog"/)
assert.match(controls, />\s*Cancel\s*</)
assert.match(controls, /Confirm close/)
assert.match(controls, /Later device records will be blocked after closure/)
assert.match(
  controls,
  /\/api\/coconut-counting\/sessions\/\$\{encodeURIComponent\(sessionUuid\)\}\/close/,
)

const sessionUuid = "ba60d16a-398c-4041-9962-7e00822aa870"
const target = new URL(
  `http://harvest-api-pilot:8000/api/coconut-counting/sessions/${sessionUuid}/close`,
)
const timestamp = "1788163200"
const secret = "test-preview-service-signing-secret"
const assertion = getAuthenticatedUserAssertionHeaders({
  requestHeaders: new Headers({ "x-mfms-user": "preview-acceptance-admin" }),
  method: "POST",
  target,
  timestamp,
  environment: {
    MFMS_ENV: "preview",
    MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
    HARVEST_API_PASSWORD: secret,
  },
})
const canonical = [
  timestamp,
  "POST",
  `/api/coconut-counting/sessions/${sessionUuid}/close`,
  "preview-acceptance-admin",
].join("\n")
assert.equal(assertion["X-MFMS-Authenticated-User"], "preview-acceptance-admin")
assert.equal(
  assertion["X-MFMS-Authenticated-User-Signature"],
  createHmac("sha256", secret).update(canonical, "utf8").digest("hex"),
)

console.log("Coconut Counting authenticated session close contract: PASS")
