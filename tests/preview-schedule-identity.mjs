import assert from "node:assert/strict"

import {
  PipelineIdentityError,
  resolveTrustedPipelineIdentity,
} from "../lib/irrigation-pipeline-identity.ts"

function gatewayHeaders(role, {
  environment = "preview",
  includePermission = true,
  permission = "read",
  username = "validated-user",
} = {}) {
  const headers = new Headers({
    "X-MFMS-User": username,
    "X-MFMS-Role": role,
    "X-MFMS-Environment": environment,
  })
  if (includePermission) headers.set("X-MFMS-Permission", permission)
  return headers
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
  assert.deepEqual(
    resolveTrustedPipelineIdentity(
      gatewayHeaders(gatewayRole, { environment: "production", includePermission: false }),
      "production",
      "GET",
    ),
    { username: "validated-user", role: assertionRole, environment: "production" },
  )
}

for (const gatewayRole of ["owner", "admin", "manager"]) {
  assert.deepEqual(
    resolveTrustedPipelineIdentity(
      gatewayHeaders(gatewayRole, { environment: "production", includePermission: false }),
      "production",
      "PUT",
    ),
    {
      username: "validated-user",
      role: gatewayRole === "owner" ? "admin" : gatewayRole,
      environment: "production",
    },
  )
}

assert.deepEqual(
  resolveTrustedPipelineIdentity(gatewayHeaders("owner", { permission: "write" }), "preview", "PUT"),
  { username: "validated-user", role: "admin", environment: "preview" },
)
assert.deepEqual(
  resolveTrustedPipelineIdentity(gatewayHeaders("manager", { permission: "write" }), "preview", "PUT"),
  { username: "validated-user", role: "manager", environment: "preview" },
)

function rejectsWith(input, status, pattern) {
  assert.throws(
    input,
    (error) => error instanceof PipelineIdentityError && error.status === status && pattern.test(error.message),
  )
}

const missingUser = gatewayHeaders("owner", { includePermission: false })
missingUser.delete("X-MFMS-User")
rejectsWith(
  () => resolveTrustedPipelineIdentity(missingUser, "preview", "GET"),
  401,
  /authenticated MFMS user/i,
)
const missingEnvironment = gatewayHeaders("owner", { includePermission: false })
missingEnvironment.delete("X-MFMS-Environment")
rejectsWith(
  () => resolveTrustedPipelineIdentity(missingEnvironment, "preview", "GET"),
  401,
  /environment does not match/i,
)
const missingRole = gatewayHeaders("owner", { includePermission: false })
missingRole.delete("X-MFMS-Role")
rejectsWith(
  () => resolveTrustedPipelineIdentity(missingRole, "preview", "GET"),
  403,
  /role is missing or unsupported/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(
    gatewayHeaders("unsupported", { includePermission: false }),
    "preview",
    "GET",
  ),
  403,
  /role is missing or unsupported/i,
)

const mismatchedEnvironment = gatewayHeaders("owner", { environment: "production", includePermission: false })
rejectsWith(
  () => resolveTrustedPipelineIdentity(mismatchedEnvironment, "preview", "GET"),
  401,
  /environment does not match/i,
)

for (const gatewayRole of ["viewer", "tester"]) {
  rejectsWith(
    () => resolveTrustedPipelineIdentity(
      gatewayHeaders(gatewayRole, { includePermission: false }),
      "preview",
      "PUT",
    ),
    403,
    /read-only/i,
  )
  rejectsWith(
    () => resolveTrustedPipelineIdentity(gatewayHeaders(gatewayRole, { permission: "write" }), "preview", "PUT"),
    403,
    /read-only/i,
  )
}

rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("owner", { permission: "write" }), "preview", "GET"),
  403,
  /permission does not allow/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("owner", { permission: "read" }), "preview", "PUT"),
  403,
  /permission does not allow/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("owner", { permission: "" }), "preview", "GET"),
  403,
  /permission is unsupported/i,
)
rejectsWith(
  () => resolveTrustedPipelineIdentity(gatewayHeaders("owner", { permission: "execute" }), "preview", "GET"),
  403,
  /permission is unsupported/i,
)

const forgedGatewayIdentity = gatewayHeaders("owner", { permission: "write" })
rejectsWith(
  () => resolveTrustedPipelineIdentity(forgedGatewayIdentity, "preview", "PUT", false),
  503,
  /trusted MFMS proxy identity headers are not enabled/i,
)
const downstreamSpoof = new Headers({
  "X-MFMS-Authenticated-User": "spoofed-owner",
  "X-MFMS-Authenticated-Role": "admin",
  "X-MFMS-Authenticated-Environment": "preview",
  "X-MFMS-Authenticated-Permission": "write",
})
rejectsWith(
  () => resolveTrustedPipelineIdentity(downstreamSpoof, "preview", "PUT"),
  401,
  /authenticated MFMS user/i,
)

console.log("Preview schedule identity compatibility and fail-closed regression passed")
