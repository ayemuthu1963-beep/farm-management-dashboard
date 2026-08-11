import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import {
  normalizePublicEnvironment,
  publicEnvironmentIdentity,
} from "../lib/public-environment.ts"

assert.equal(normalizePublicEnvironment("Production"), "production")
assert.equal(normalizePublicEnvironment("PREVIEW"), "preview")
assert.equal(normalizePublicEnvironment("test"), "test")
assert.equal(normalizePublicEnvironment("Vercel Preview"), "vercel")

for (const [environment, database] of [
  ["production", "mfms_server_prod"],
  ["preview", "mfms_server_uat"],
  ["test", "mfms_server_test"],
]) {
  const identity = publicEnvironmentIdentity(environment, database)
  assert.equal(identity.databaseMismatch, false)
  assert.equal(identity.database, database)
}

assert.equal(
  publicEnvironmentIdentity("test", "mfms_server_prod").databaseMismatch,
  true,
)
assert.equal(
  publicEnvironmentIdentity("production", "mfms_server_uat").databaseMismatch,
  true,
)
assert.equal(
  publicEnvironmentIdentity("preview", undefined).databaseMismatch,
  true,
)

const banner = await readFile("components/farm/environment-banner.tsx", "utf8")
assert.match(banner, /VERCEL VALIDATION - DISPOSABLE BUILD - NO LIVE MFMS DATABASE/)
assert.match(banner, /CONFIGURATION MISMATCH/)
assert.match(banner, /vercelEnvironment\s*\n\s*\? undefined/)
assert.match(banner, /data-mfms-environment/)
assert.match(banner, /data-mfms-database/)

const layout = await readFile("app/layout.tsx", "utf8")
assert.match(layout, /<EnvironmentBanner \/>/)
assert.match(layout, /process\.env\.VERCEL === '1'/)

const versionRoute = await readFile("app/api/version/route.ts", "utf8")
assert.match(versionRoute, /public_environment:/)
assert.match(versionRoute, /database:/)

console.log("environment identity tests passed")
