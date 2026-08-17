import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const helper = readFileSync(
  new URL("./20260817-irrigation-preview-production-bridge.sh", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n")

for (const exactValue of [
  "418d9e1cc36cc6298c5f4036792418b478276bc5a7774819a9f2b83005263283",
  "sha256:4159d9e484855be68eacf32a41b895e311ff2957b56f3be05f39dfae133cf266",
  "fc791dfb090874e8ba16408ee38f910f161c9a52",
  "315da9cfecbaa4ed7e1568e556f4a04ef8480e8f39210ad37c168972719da0a6",
  "sha256:2fc73dd136c30cb1be58c55e60f4f9fcffe9f084c248acb7808c5c62dc73a8d5",
  "9842f21a4bb04ff4f1750790392dbfee0dc941d3",
  "71f50a9f6a33a2e5bf5590b7ea3439a59757f595f1cce2e9315a4a2c6c21e0cd",
  "172.19.128.10",
  "172.19.0.11",
  'readonly live_port="3015"',
]) {
  assert.ok(helper.includes(exactValue), `missing hardcoded release value: ${exactValue}`)
}

assert.match(helper, /readonly -a approved_running_services=\(/)
const manifest = helper.match(/readonly -a approved_running_services=\(([^)]*)\)/)?.[1]
assert.ok(manifest)
assert.equal(manifest.trim().split("\n").length, 21)
assert.match(helper, /ONE_TIME_PREVIEW_SWITCH_DRY_RUN=PASS/)
assert.match(helper, /TEMPORARY_PREVIEW_READY=PASS/)
assert.match(helper, /PREVIEW_RESTORATION=PASS/)
assert.match(helper, /trap cleanup EXIT/)
assert.match(helper, /trap 'exit 129' HUP/)
assert.match(helper, /trap 'exit 130' INT/)
assert.match(helper, /trap 'exit 143' TERM/)
assert.match(helper, /read -r -t "\$wait_timeout_seconds"/)
assert.match(helper, /container_environment_sha256/)
assert.match(helper, /validate_protected_snapshot/)
assert.match(helper, /flock -n 9/)
assert.match(helper, /--restore-only/)

assert.doesNotMatch(helper, /docker\s+build/)
assert.doesNotMatch(helper, /docker\s+pull/)
assert.doesNotMatch(helper, /docker\s+rmi/)
assert.doesNotMatch(helper, /docker\s+rm\s+-f/)
assert.doesNotMatch(helper, /last-successful-frontend-switch/)
assert.doesNotMatch(helper, /production-server-deploy/)
assert.doesNotMatch(helper, /expected_running_containers/)

console.log("One-time Irrigation Preview bridge helper contract: PASS")
