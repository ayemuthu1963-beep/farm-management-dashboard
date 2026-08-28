import assert from "node:assert/strict"

import {
  PipelineIdentityError,
  resolveTrustedPipelineIdentity,
} from "../lib/irrigation-pipeline-identity.ts"

function gatewayHeaders(role, permission = "read") {
  return new Headers({
    "X-MFMS-User": "validated-user",
    "X-MFMS-Role": role,
    "X-MFMS-Environment": "preview",
    "X-MFMS-Permission": permission,
  })
}

for (const [gatewayRole, assertionRole] of [
  ["owner", "admin"],
  ["admin", "admin"],
  ["manager", "manager"],
  ["viewer", "viewer"],
  ["tester", "viewer"],
]) {
  assert.deepEqual(
    resolveTrustedPipelineIdentity(gatewayHeaders(gatewayRole), "preview", "GET"),
    { username: "validated-user", role: assertionRole, environment: "preview" },
  )
}

assert.deepEqual(
  resolveTrustedPipelineIdentity(gatewayHeaders("owner", "write"), "preview", "PUT"),
  { username: "validated-user", role: "admin", environment: "preview" },
)
assert.deepEqual(
  resolveTrustedPipelineIdentity(gatewayHeaders("manager", "write"), "preview", "PUT"),
  { username: "validated-user", role: "manager", environment: "preview" },
)

function rejectsWith(input, status, pattern) {
  assert.throws(
    input,
    (error) => error instanceof PipelineIdentityError && error.status === status && pattern.test(error.message),
  )
}

rejectsWith(
  () => resolveTrustedPipelineIdentity(new Headers(), "preview", "GET"),
  401,
  /authenticated MFMS user/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("unsupported"), "preview", "GET"),
  403,
  /role is missing or unsupported/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(new Headers({ "X-MFMS-Role": "owner" }), "preview", "GET"),
  401,
  /authenticated MFMS user/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("owner"), "preview", "GET", false),
  503,
  /trusted MFMS proxy identity headers are not enabled/i,
)
const missingPermission = gatewayHeaders("owner")
missingPermission.delete("X-MFMS-Permission")
rejectsWith(
  () => resolveTrustedPipelineIdentity(missingPermission, "preview", "GET"),
  403,
  /permission does not allow/i,
)

const mismatchedEnvironment = gatewayHeaders("owner")
mismatchedEnvironment.set("X-MFMS-Environment", "production")
rejectsWith(
  () => resolveTrustedPipelineIdentity(mismatchedEnvironment, "preview", "GET"),
  401,
  /environment does not match/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("viewer", "write"), "preview", "PUT"),
  403,
  /read-only/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("owner", "write"), "preview", "GET"),
  403,
  /permission does not allow/i,
)

console.log("Preview schedule identity fail-closed regression passed")
