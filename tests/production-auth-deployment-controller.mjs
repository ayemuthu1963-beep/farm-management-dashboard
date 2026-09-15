import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { selectTestBash } from "./select-test-bash.mjs"

const readText = path => readFileSync(path, "utf8").replace(/\r\n/g, "\n")
const sha256 = value => createHash("sha256").update(value).digest("hex")
const controller = readText("scripts/production-server-auth-deploy.sh")
// Git stores the executable helper with LF endings; normalize Windows checkouts
// before checking the reviewed Linux deployment bytes.
const guard = Buffer.from(readText("scripts/production-auth-session-guard.py"), "utf8")
const backendController = readText("scripts/production-server-backend-deploy.sh")
const bash = selectTestBash()
const python = process.env.MFMS_TEST_PYTHON || (process.platform === "win32" ? "python" : "python3")

// The prior general backend controller remains entirely unchanged by this PR.
assert.equal(
  sha256(backendController),
  "e5ccbec43639bbcf1ee55da7238b6f5136edf791ca7400bd359834843b9e4507",
)

for (const exact of [
  "894a61c5f6302e183ca95c193e41538e7554b85546f4c0020262b33c787b8f83",
  "sha256:4d7cb4c30ecc7a2e974674b5b0bbe816d8dc59aebfc1addc69873b8ae47caaab",
  "79cf46e75fcca318a136a1e1c7fe173de6dc3026",
  "sha256:359398ec487f58763b560435ea05e49ad813fe3f6958f7d0cecc48840d93a972",
  "aa1a345e4946038eb0a3cba7d9e626fe4f21c46c",
  "922d4b30f3e4724475d7b7010fe5ac295fc3c948",
  "373c45d73f11a353550f4d64ca7aca16839d2a98",
]) {
  assert.ok(controller.includes(exact), `missing exact one-attempt binding ${exact}`)
}

assert.match(controller, /readonly candidate_container=mfms-auth-candidate-intelligence-922d4b30-attempt2/)
assert.match(controller, /readonly prior_failed_container=mfms-auth-failed-aa1a345-20260915T115331Z/)
assert.match(controller, /the one-time semantic auth attempt was already consumed/)
assert.match(controller, /current Production auth revision drifted/)
assert.match(controller, /start_isolated_candidate/)
assert.match(controller, /--network none/)
assert.match(controller, /target Production auth network scope drifted/)
assert.match(controller, /AUTH_PUBLIC_HOST=auth\.muthufarms\.com/)
assert.match(controller, /AUTH_SESSION_ISSUER=mfms-auth-production/)
assert.match(controller, /AUTH_SESSION_AUDIENCE=mfms-production/)
assert.match(controller, /AUTH_SESSION_ENVIRONMENT=production/)
assert.match(controller, /AUTH_SESSION_COOKIE_NAME=__Secure-mfms_session/)
assert.match(controller, /AUTH_ACCEPT_LEGACY_PRODUCTION_SESSIONS=true/)
assert.match(controller, /AUTH_LEGACY_PRODUCTION_DATA_DIR=\/data/)
assert.match(controller, /AUTH_SESSION_SIGNING_KEY_FILE=\/run\/secrets\/browser-session-signing-key/)
assert.match(controller, /Preview auth identity or health drifted/)
assert.match(controller, /effective Nginx configuration drifted/)
assert.match(controller, /nginx -T 2>\/dev\/null \| sha256sum/)
assert.doesNotMatch(controller, /nginx -T 2>&1 \| sha256sum/)
assert.equal(
  (controller.match(/Mounts\|map\(\{Type,Source,Destination,RW\}\)\|sort_by\(\.Destination,\.Source,\.Type,\.RW\)/g) || []).length,
  2,
)
assert.match(controller, /Production user store drifted/)
assert.match(controller, /--require-active-user harsha/)
assert.match(controller, /failed_evidence_changed=0/)
assert.match(controller, /AUTH_ROLLBACK_DRY_RUN=PASS/)

const compareIndex = controller.indexOf('python3 "$session_guard" compare')
const renameIndex = controller.indexOf('docker rename "$candidate_container" "$live_container"')
const networkIndex = controller.indexOf(
  'docker network connect --ip "$production_ip" "$production_network" "$live_container"',
  renameIndex,
)
assert.ok(compareIndex > 0 && compareIndex < renameIndex && renameIndex < networkIndex)

// The previously failed candidate is evidence only: it may be inspected, never mutated.
for (const command of ["stop", "start", "restart", "rename", "rm", "kill", "pause", "unpause"]) {
  assert.doesNotMatch(controller, new RegExp(`docker ${command}[^\\n]*\\$prior_failed_container`))
}
assert.doesNotMatch(controller, /docker network (?:connect|disconnect)[^\n]*\$prior_failed_container/)

// No application/database/proxy mutation is present.
assert.doesNotMatch(controller, /\b(?:psql|pg_dump|pg_restore|alembic|migrate|migration)\b/i)
assert.doesNotMatch(controller, /nginx\s+-(?:s|t)|docker\s+(?:stop|start|restart|rm|rename)[^\n]*\$nginx_container/)
assert.doesNotMatch(controller, /harvest-api|mfms-v0-preview-web/)

const guardHashMatch = /readonly expected_session_guard_sha=([0-9a-f]{64})/.exec(controller)
assert.ok(guardHashMatch)
assert.equal(guardHashMatch[1], sha256(guard))

const syntax = spawnSync(bash, ["--noprofile", "--norc", "-n", "scripts/production-server-auth-deploy.sh"], {
  encoding: "utf8",
  shell: false,
})
assert.equal(syntax.status, 0, syntax.stdout + syntax.stderr)

const guardTests = spawnSync(python, ["tests/test_production_auth_session_guard.py"], {
  encoding: "utf8",
  shell: false,
  timeout: 120000,
})
assert.equal(guardTests.status, 0, guardTests.stdout + guardTests.stderr)

function shellFunction(source, name) {
  const marker = `${name}() {`
  const start = source.indexOf(marker)
  assert.ok(start >= 0, `missing function ${name}`)
  let depth = 0
  let quote = null
  for (let index = start + marker.indexOf("{"); index < source.length; index += 1) {
    const character = source[index]
    const previous = source[index - 1]
    if (quote) {
      if (character === quote && previous !== "\\") quote = null
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      continue
    }
    if (character === "{") depth += 1
    if (character === "}") {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`unterminated function ${name}`)
}

// Exercise the original-container restoration sequence with a hermetic Docker stub.
const temporary = mkdtempSync(join(tmpdir(), "mfms-auth-rollback-test-"))
try {
  const harness = join(temporary, "rollback-harness.sh")
  const trace = join(temporary, "trace.txt").replace(/\\/g, "/")
  const fixtureState = join(temporary, "state").replace(/\\/g, "/")
  const body = `set -Eeuo pipefail
trace='${trace}'
candidate_container=mfms-auth-candidate-intelligence-922d4b30-attempt2
live_container=mfms-auth
target_image=sha256:${"3".repeat(64)}
current_image=sha256:${"4".repeat(64)}
current_container_id=${"a".repeat(64)}
current_revision=${"b".repeat(40)}
production_network=harvest-net
production_ip=172.19.128.2
session_guard=/fixture/guard
sessions_file=/fixture/sessions.json
state_dir='${fixtureState}'
release_state="$state_dir/release.env"
mkdir -p "$(dirname "$release_state")"
printf 'ATTEMPT_STATUS=started\\n' > "$release_state"
touch "$state_dir/manifest.json" "$state_dir/sessions.t0.backup"
docker() {
  printf '%s\\n' "$*" >> "$trace"
  if [[ "$1 $2" == 'ps -a' ]]; then
    printf '%s\\n' "$candidate_container" mfms-auth-pre-semantic-922d4b30-20330518T033320Z
  elif [[ "$1" == inspect && "$2" == --format && "$4" == "$candidate_container" ]]; then
    printf '%s\\n' "$target_image"
  elif [[ "$1" == inspect && "$2" == --format && "$4" == "$live_container" ]]; then
    printf '%s\\n' "$current_container_id|$current_image|healthy|0"
  fi
}
python3() { printf 'python3 %s\\n' "$*" >> "$trace"; }
wait_for_health() { printf 'wait_for_health %s\\n' "$*" >> "$trace"; }
mark_attempt() { printf 'mark_attempt %s\\n' "$*" >> "$trace"; }
container_revision() { printf '%s\\n' "$current_revision"; }
assert_prior_failure_evidence() { return 0; }
${shellFunction(controller, "restore_original_auth")}
restore_original_auth mfms-auth-pre-semantic-922d4b30-20330518T033320Z
`
  writeFileSync(harness, body)
  const result = spawnSync(bash, ["--noprofile", "--norc", harness], { encoding: "utf8", shell: false })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const operations = readText(trace)
  assert.match(operations, /stop --time 30 mfms-auth-candidate-intelligence-922d4b30-attempt2/)
  assert.match(operations, /rename mfms-auth-candidate-intelligence-922d4b30-attempt2 mfms-auth-failed-semantic-922d4b30-/)
  assert.match(operations, /python3 \/fixture\/guard restore/)
  assert.match(operations, /rename mfms-auth-pre-semantic-922d4b30-20330518T033320Z mfms-auth/)
  assert.match(operations, /network connect --ip 172\.19\.128\.2 harvest-net mfms-auth/)
  assert.match(operations, /start mfms-auth/)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}

const reuseDirectory = mkdtempSync(join(tmpdir(), "mfms-auth-reuse-test-"))
try {
  const harness = join(reuseDirectory, "reuse-harness.sh")
  const body = `set -u
current_container_id=894a61c5f6302e183ca95c193e41538e7554b85546f4c0020262b33c787b8f83
current_image=sha256:4d7cb4c30ecc7a2e974674b5b0bbe816d8dc59aebfc1addc69873b8ae47caaab
current_revision=79cf46e75fcca318a136a1e1c7fe173de6dc3026
live_container=mfms-auth
production_ip=172.19.128.2
blocked() { printf '%s\\n' "$1" >&2; return 1; }
docker() {
  if [[ "$1" == inspect && "$2" == --format ]]; then
    printf '%s\\n' "$current_container_id|$current_image|running|healthy|0"
  fi
}
container_revision() { printf '%s\\n' aa1a345e4946038eb0a3cba7d9e626fe4f21c46c; }
${shellFunction(controller, "assert_current_auth")}
assert_current_auth
`
  writeFileSync(harness, body)
  const result = spawnSync(bash, ["--noprofile", "--norc", harness], { encoding: "utf8", shell: false })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /current Production auth revision drifted/)
} finally {
  rmSync(reuseDirectory, { recursive: true, force: true })
}

console.log("Production auth semantic deployment controller contracts passed.")
