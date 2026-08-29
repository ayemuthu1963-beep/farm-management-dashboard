import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"

import {
  pipelineAssertionRole,
  PipelineIdentityError,
  resolveTrustedPipelineIdentity,
} from "../lib/irrigation-pipeline-identity.ts"
import {
  signActorAssertion,
  signAuthenticatedUserAssertion,
  WorkerBffError,
} from "../lib/worker-management-signing.ts"

const require = createRequire(import.meta.url)
const ts = require("typescript")

function loadPipelineSigning() {
  const source = fs.readFileSync(new URL("../lib/irrigation-pipeline-signing.ts", import.meta.url), "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const module = { exports: {} }
  const localRequire = (specifier) => {
    if (specifier === "@/lib/worker-management-signing") return { WorkerBffError }
    if (specifier === "@/lib/irrigation-pipeline-identity") {
      return { pipelineAssertionRole, PipelineIdentityError, resolveTrustedPipelineIdentity }
    }
    throw new Error(`Unexpected pipeline-signing dependency: ${specifier}`)
  }
  Function("require", "module", "exports", output)(localRequire, module, module.exports)
  return module.exports
}

const { resolvePipelineActor } = loadPipelineSigning()

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

function rejectsWorkerWith(input, status, pattern) {
  assert.throws(
    input,
    (error) => error instanceof WorkerBffError && error.status === status && pattern.test(error.message),
  )
}

const clientClaimingDevelopment = gatewayHeaders("owner", {
  environment: "development",
  permission: "write",
  username: "client-spoofed-owner",
})
const developmentActor = resolvePipelineActor(clientClaimingDevelopment, {
  MFMS_ENV: "development",
  MFMS_WORKER_LOCAL_ACTOR_ENABLED: "true",
  MFMS_WORKER_LOCAL_ACTOR_USERNAME: "configured-local-owner",
  MFMS_WORKER_LOCAL_ACTOR_ROLE: "owner",
}, "PUT")
assert.deepEqual(developmentActor, {
  username: "configured-local-owner",
  role: "admin",
  environment: "local",
}, "trusted MFMS_ENV=development uses only the configured local actor and normalizes its signed environment")

const assertionInput = {
  timestamp: "1787932800",
  method: "PUT",
  target: "/api/operator-settings/irrigation-plan/motor-run-schedule",
  bodySha256: "0".repeat(64),
  username: developmentActor.username,
  role: developmentActor.role,
  environment: developmentActor.environment,
}
assert.match(signActorAssertion("development-actor-secret-value-1234567890", assertionInput), /^[a-f0-9]{64}$/)
assert.match(signAuthenticatedUserAssertion("development-basic-auth-secret", assertionInput), /^[a-f0-9]{64}$/)

assert.deepEqual(resolvePipelineActor(new Headers(), {
  MFMS_ENV: "local",
  MFMS_WORKER_LOCAL_ACTOR_ENABLED: "true",
  MFMS_WORKER_LOCAL_ACTOR_USERNAME: "configured-local-admin",
  MFMS_WORKER_LOCAL_ACTOR_ROLE: "admin",
}), {
  username: "configured-local-admin",
  role: "admin",
  environment: "local",
})

for (const [configuredRole, assertionRole] of [
  ["owner", "admin"],
  ["admin", "admin"],
  ["manager", "manager"],
]) {
  assert.deepEqual(resolvePipelineActor(new Headers(), {
    MFMS_ENV: "development",
    MFMS_WORKER_LOCAL_ACTOR_ENABLED: "true",
    MFMS_WORKER_LOCAL_ACTOR_USERNAME: `configured-local-${configuredRole}`,
    MFMS_WORKER_LOCAL_ACTOR_ROLE: configuredRole,
  }, "PUT"), {
    username: `configured-local-${configuredRole}`,
    role: assertionRole,
    environment: "local",
  })
}

for (const configuredRole of ["viewer", "tester"]) {
  const localEnvironment = {
    MFMS_ENV: "development",
    MFMS_WORKER_LOCAL_ACTOR_ENABLED: "true",
    MFMS_WORKER_LOCAL_ACTOR_USERNAME: `configured-local-${configuredRole}`,
    MFMS_WORKER_LOCAL_ACTOR_ROLE: configuredRole,
  }
  assert.deepEqual(resolvePipelineActor(new Headers(), localEnvironment, "GET"), {
    username: `configured-local-${configuredRole}`,
    role: "viewer",
    environment: "local",
  })
  rejectsWorkerWith(
    () => resolvePipelineActor(new Headers(), localEnvironment, "PUT"),
    403,
    /viewer access is read-only/i,
  )
}

for (const configuredEnvironment of ["preview", "uat", "test", "production", "prod"]) {
  assert.deepEqual(resolvePipelineActor(
    gatewayHeaders("owner", { environment: configuredEnvironment, includePermission: false }),
    {
      MFMS_ENV: configuredEnvironment,
      MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
    },
    "GET",
  ), {
    username: "validated-user",
    role: "admin",
    environment: configuredEnvironment,
  })
}

for (const configuredEnvironment of ["staging", "production-candidate", "vercel"]) {
  rejectsWorkerWith(
    () => resolvePipelineActor(
      gatewayHeaders("owner", { environment: configuredEnvironment, includePermission: false }),
      {
        MFMS_ENV: configuredEnvironment,
        MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
      },
      "GET",
    ),
    403,
    /environment is not approved/i,
  )
}

for (const configuredEnvironment of ["preview", "production"]) {
  rejectsWorkerWith(
    () => resolvePipelineActor(new Headers(), {
      MFMS_ENV: configuredEnvironment,
      MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
    }),
    401,
    /authenticated MFMS user/i,
  )
  rejectsWorkerWith(
    () => resolvePipelineActor(clientClaimingDevelopment, {
      MFMS_ENV: configuredEnvironment,
      MFMS_TRUST_PROXY_ACTOR_HEADERS: "true",
    }, "PUT"),
    401,
    /environment does not match/i,
  )
}

rejectsWorkerWith(
  () => resolvePipelineActor(clientClaimingDevelopment, {
    NEXT_PUBLIC_MFMS_ENV: "development",
    MFMS_WORKER_LOCAL_ACTOR_ENABLED: "true",
    MFMS_WORKER_LOCAL_ACTOR_USERNAME: "configured-local-owner",
    MFMS_WORKER_LOCAL_ACTOR_ROLE: "owner",
  }, "PUT"),
  503,
  /MFMS_ENV must select/i,
)

console.log("Preview schedule identity compatibility and fail-closed regression passed")
