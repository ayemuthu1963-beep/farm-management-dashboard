import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import {
  getAuthenticatedUserAssertionHeaders,
  MfmsAdminIdentityError,
  resolveMfmsAdminUsername,
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
