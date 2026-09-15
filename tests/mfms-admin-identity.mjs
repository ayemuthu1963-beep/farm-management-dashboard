import assert from "node:assert/strict"
import { createHash, createHmac } from "node:crypto"
import {
  getAuthenticatedUserAssertionHeaders,
  getIntelligenceActorAssertionHeaders,
  MfmsAdminIdentityError,
  resolveMfmsAdminUsername,
  resolveMfmsIntelligenceActor,
} from "../lib/mfms-admin-identity.ts"
import { getAdminTargetSafetyErrors } from "../lib/preview-admin-write-safety.ts"

const gatewayHeaders = new Headers({ "x-mfms-user": "farm-admin" })
const trustedProduction = {
  MFMS_ENV: "production",
  MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
  HARVEST_API_PASSWORD: "test-signing-secret",
}

assert.equal(resolveMfmsAdminUsername(gatewayHeaders, trustedProduction), "farm-admin")
assert.throws(
  () => resolveMfmsAdminUsername(gatewayHeaders, { ...trustedProduction, MFMS_TRUST_PROXY_ACTOR_HEADERS: "false" }),
  (error) => error instanceof MfmsAdminIdentityError && error.status === 503,
)
assert.throws(
  () => resolveMfmsAdminUsername(new Headers(), trustedProduction),
  (error) => error instanceof MfmsAdminIdentityError && error.status === 401,
)

const localHeaders = new Headers({
  Authorization: `Basic ${Buffer.from("local-admin:password").toString("base64")}`,
})
assert.equal(resolveMfmsAdminUsername(localHeaders, { MFMS_ENV: "local" }), "local-admin")

const target = new URL("http://harvest-api:8000/api/admin/well-water/sync?source=odk")
const signed = getAuthenticatedUserAssertionHeaders({
  requestHeaders: gatewayHeaders,
  method: "POST",
  target,
  environment: trustedProduction,
  timestamp: "1786435200",
})
const canonical = [
  "1786435200",
  "POST",
  "/api/admin/well-water/sync?source=odk",
  "farm-admin",
].join("\n")
assert.equal(
  signed["X-MFMS-Authenticated-User-Signature"],
  createHmac("sha256", "test-signing-secret").update(canonical, "utf8").digest("hex"),
)
assert.equal(signed["X-MFMS-Authenticated-User"], "farm-admin")

const previewIntelligenceEnvironment = {
  MFMS_ENV: "preview",
  MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
  HARVEST_API_PASSWORD: "test-signing-secret",
  MFMS_ACTOR_ASSERTION_SECRET: "preview-actor-assertion-secret-for-tests",
}
const viewerHeaders = new Headers({
  "x-mfms-user": "Edward",
  "x-mfms-role": "viewer",
  "x-mfms-environment": "preview",
  "x-mfms-permission": "read",
  "x-mfms-authenticated-role": "admin",
  "x-mfms-authenticated-signature": "f".repeat(64),
})
assert.deepEqual(resolveMfmsIntelligenceActor(viewerHeaders, previewIntelligenceEnvironment), {
  username: "Edward",
  role: "viewer",
  environment: "preview",
})
const intelligenceTarget = new URL("http://harvest-api-pilot:8000/api/intelligence/ask")
const intelligenceBody = JSON.stringify({ question: "How many beetles were caught on 17 August?" })
const intelligenceSigned = getIntelligenceActorAssertionHeaders({
  requestHeaders: viewerHeaders,
  method: "POST",
  target: intelligenceTarget,
  body: intelligenceBody,
  environment: previewIntelligenceEnvironment,
  timestamp: "1789344000",
})
const bodySha256 = createHash("sha256").update(intelligenceBody).digest("hex")
const actorCanonical = [
  "1789344000",
  "POST",
  "/api/intelligence/ask",
  bodySha256,
  "Edward",
  "viewer",
  "preview",
].join("\n")
assert.equal(intelligenceSigned["X-MFMS-Authenticated-Role"], "viewer")
assert.equal(intelligenceSigned["X-MFMS-Authenticated-Environment"], "preview")
assert.equal(intelligenceSigned["X-MFMS-Authenticated-Body-SHA256"], bodySha256)
assert.equal(
  intelligenceSigned["X-MFMS-Authenticated-Signature"],
  createHmac("sha256", previewIntelligenceEnvironment.MFMS_ACTOR_ASSERTION_SECRET).update(actorCanonical).digest("hex"),
)
assert.notEqual(intelligenceSigned["X-MFMS-Authenticated-Signature"], "f".repeat(64))
assert.equal(resolveMfmsIntelligenceActor(new Headers({
  "x-mfms-user": "owner",
  "x-mfms-role": "owner",
  "x-mfms-environment": "preview",
  "x-mfms-permission": "read",
}), previewIntelligenceEnvironment).role, "admin")
for (const rejectedHeaders of [
  new Headers({ "x-mfms-role": "viewer", "x-mfms-environment": "preview", "x-mfms-permission": "read" }),
  new Headers({ "x-mfms-user": "Edward", "x-mfms-role": "viewer", "x-mfms-environment": "production", "x-mfms-permission": "read" }),
  new Headers({ "x-mfms-user": "Edward", "x-mfms-role": "viewer", "x-mfms-environment": "preview", "x-mfms-permission": "write" }),
  new Headers({ "x-mfms-user": "Edward", "x-mfms-role": "tester", "x-mfms-environment": "preview", "x-mfms-permission": "read" }),
]) {
  assert.throws(
    () => resolveMfmsIntelligenceActor(rejectedHeaders, previewIntelligenceEnvironment),
    (error) => error instanceof MfmsAdminIdentityError && [401, 403].includes(error.status),
  )
}

const productionTarget = {
  MFMS_ENV: "production",
  NEXT_PUBLIC_MFMS_ENV: "production",
  MFMS_ENABLE_LOCAL_WRITE_GUARD: "true",
  MFMS_TARGET_DATABASE: "mfms_server_prod",
  MFMS_LOCAL_WRITE_DATABASE: "mfms_server_prod",
  MFMS_LOCAL_WRITE_BACKEND_HOST: "harvest-api",
  MFMS_LOCAL_WRITE_BACKEND_PORT: "8000",
  MFMS_ALLOWED_BACKEND_HOSTS: "harvest-api",
  MFMS_ALLOWED_BACKEND_PORT: "8000",
}
assert.deepEqual(
  getAdminTargetSafetyErrors(productionTarget, "http://harvest-api:8000"),
  [],
)
assert.match(
  getAdminTargetSafetyErrors(
    { ...productionTarget, MFMS_TARGET_DATABASE: "mfms_server_uat" },
    "http://harvest-api:8000",
  ).join(" "),
  /mfms_server_prod/,
)
assert.match(
  getAdminTargetSafetyErrors(
    { ...productionTarget, MFMS_ENV: "test", NEXT_PUBLIC_MFMS_ENV: "test" },
    "http://harvest-api:8000",
  ).join(" "),
  /mfms_server_test|Production database names are rejected/,
)

console.log("MFMS shared administrator identity contract: PASS")
