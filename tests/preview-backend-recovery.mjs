import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const scriptPath = "scripts/preview-server-backend-recovery.sh"
const source = readFileSync(scriptPath, "utf8").replace(/\r\n/g, "\n")
const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash"

function bashFunction(command, env = {}) {
  return spawnSync(
    bash,
    ["-c", `export MFMS_RECOVERY_LIBRARY_ONLY=1; source ${scriptPath}; ${command}`],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ...env },
    },
  )
}

function assertPass(label, command, env = {}) {
  const result = bashFunction(command, env)
  assert.equal(result.error, undefined, `${label}: bash must be available`)
  assert.equal(result.status, 0, `${label}: ${result.stderr}`)
}

function assertFail(label, command, env = {}) {
  const result = bashFunction(command, env)
  assert.equal(result.error, undefined, `${label}: bash must be available`)
  assert.notEqual(result.status, 0, `${label}: command unexpectedly passed`)
}

const revision = "ab6a78ba7869c2d18fd4dba2f7022febd38e7b77"
const imageId = "sha256:2d7e405460d75863009ba18877c657a6d818c9dfa4ddf97831ce6c6af1de385a"
const imageTag = "muthu-harvest-dashboard-harvest-api:preview-ab6a78b-20260804T124337Z"

assert.match(source, new RegExp(`readonly expected_revision="${revision}"`))
assert.match(source, new RegExp(`readonly expected_image_id="${imageId}"`))
assert.match(source, new RegExp(`readonly expected_image_tag="${imageTag}"`))
assert.match(source, /readonly expected_stale_state_revision="4a4ac5aec9480ecc7eb902fad822fb6a2f11e87b"/)
assert.match(source, /readonly expected_stale_state_run_id="30877563746"/)
assert.match(source, /readonly adopt_confirmation="RESTORE PREVIEW BACKEND TO APPROVED ONE MOUNT"/)
assert.match(source, /readonly rollback_confirmation="ROLL BACK PREVIEW BACKEND RECOVERY"/)
assert.match(source, /\[\[ "\$\(id -un\)" == "muthu" \]\]/)
assert.match(source, /readonly lock_file="\$state_dir\/deployment\.lock"/)
if (process.platform !== "win32") {
  const mode = spawnSync("git", ["ls-files", "-s", "--", scriptPath], {
    encoding: "utf8",
  })
  assert.equal(mode.error, undefined, "git must be available for the mode check")
  assert.equal(mode.status, 0, mode.stderr)
  assert.equal(mode.stdout.trim().split(/\s+/, 1)[0], "100755", "recovery script must be executable")
}

assertPass("exact revision", `require_exact_revision ${revision}`)
assertFail("wrong revision", "require_exact_revision 4a4ac5aec9480ecc7eb902fad822fb6a2f11e87b")
assertPass("exact image", `require_exact_image_id ${imageId}`)
assertFail("wrong image", `require_exact_image_id sha256:${"0".repeat(64)}`)

const approvedMount = {
  Type: "bind",
  Source: "/tmp",
  Destination: "/host-tmp",
  Mode: "",
  RW: true,
  Propagation: "rprivate",
}
const screenshotMount = {
  Type: "bind",
  Source: "/home/muthu/mfms_data/preview/motor-screenshot-analysis",
  Destination: "/var/lib/mfms/motor-screenshot-analysis",
  Mode: "",
  RW: true,
  Propagation: "rprivate",
}

assertPass("approved one-mount set", 'validate_mounts_json approved "$TEST_JSON"', {
  TEST_JSON: JSON.stringify([approvedMount]),
})
assertPass("reviewed pre-recovery two-mount set", 'validate_mounts_json legacy "$TEST_JSON"', {
  TEST_JSON: JSON.stringify([approvedMount, screenshotMount]),
})
assertFail("missing approved mount", 'validate_mounts_json approved "$TEST_JSON"', {
  TEST_JSON: JSON.stringify([]),
})
assertFail("unapproved extra mount", 'validate_mounts_json approved "$TEST_JSON"', {
  TEST_JSON: JSON.stringify([approvedMount, screenshotMount]),
})
assertFail("changed destination", 'validate_mounts_json approved "$TEST_JSON"', {
  TEST_JSON: JSON.stringify([{ ...approvedMount, Destination: "/tmp" }]),
})
assertFail("changed RW mode", 'validate_mounts_json approved "$TEST_JSON"', {
  TEST_JSON: JSON.stringify([{ ...approvedMount, RW: false }]),
})

const storage = mkdtempSync(path.join(tmpdir(), "mfms-recovery-storage-"))
try {
  assertPass("empty screenshot directory", 'require_empty_storage "$TEST_STORAGE"', {
    TEST_STORAGE: storage.replaceAll("\\", "/"),
  })
  writeFileSync(path.join(storage, "must-block.txt"), "test")
  assertFail("non-empty screenshot directory", 'require_empty_storage "$TEST_STORAGE"', {
    TEST_STORAGE: storage.replaceAll("\\", "/"),
  })
} finally {
  rmSync(storage, { recursive: true, force: true })
}

const disabledFlags = {
  storage_root_matches: true,
  upload_enabled: false,
  vision_enabled: false,
  credential_configured: false,
}
assertPass("disabled screenshot features", 'validate_feature_flags_json "$TEST_JSON"', {
  TEST_JSON: JSON.stringify(disabledFlags),
})
assertFail("enabled upload blocks recovery", 'validate_feature_flags_json "$TEST_JSON"', {
  TEST_JSON: JSON.stringify({ ...disabledFlags, upload_enabled: true }),
})
assertFail("enabled Vision blocks recovery", 'validate_feature_flags_json "$TEST_JSON"', {
  TEST_JSON: JSON.stringify({ ...disabledFlags, vision_enabled: true }),
})

const oneMountFunction = source.slice(
  source.indexOf("start_one_mount_container()"),
  source.indexOf("start_legacy_candidate_container()"),
)
assert.equal((oneMountFunction.match(/--mount /g) || []).length, 1)
assert.match(oneMountFunction, /source=\$approved_mount_source,target=\$approved_mount_target/)
assert.doesNotMatch(oneMountFunction, /screenshot_mount/)

const adoptFunction = source.slice(
  source.indexOf("adopt_one_mount_contract()"),
  source.indexOf("rollback_recovery()"),
)
const postVerify = adoptFunction.indexOf("verify_unchanged_components")
const externalVerify = adoptFunction.indexOf("assert_external_endpoints")
const stateWrite = adoptFunction.indexOf("write_reconciled_state")
const stateVerify = adoptFunction.indexOf("assert_reconciled_state_matches_live")
const transactionCommit = adoptFunction.indexOf("transaction_active=0")
assert.ok(postVerify >= 0 && postVerify < stateWrite, "state must follow unchanged-component verification")
assert.ok(externalVerify >= 0 && externalVerify < stateWrite, "state must follow endpoint verification")
assert.ok(stateWrite >= 0 && stateWrite < stateVerify, "state must be verified after writing")
assert.ok(stateVerify >= 0 && stateVerify < transactionCommit, "transaction commits only after state verification")

assert.match(source, /if \[\[ "\$status" -ne 0 && "\$transaction_active" -eq 1 \]\]; then\n\s+restore_transaction_original/)
assert.match(source, /docker rename "\$transaction_original_name" "\$backend_live_container"/)
assert.match(source, /restore_checkpoint_state/)
assert.match(source, /rollback_container=none/)
assert.match(source, /manual_rollback_command=/)
assert.match(source, /assert_expected_pre_recovery_state/)

assert.match(source, /snapshot_unrelated_containers > "\$checkpoint_dir\/unrelated\.before"/)
assert.match(source, /cmp -s "\$checkpoint_dir\/unrelated\.before" "\$work_dir\/unrelated\.after"/)
assert.match(source, /frontend_unchanged=true/)
assert.match(source, /production_touched=0/)
assert.doesNotMatch(source, /docker (?:run|stop|rm|rename).*production/i)
assert.doesNotMatch(source, /(?:curl|wget).*(?:odk\.muthufarms\.com|\/v1\/projects)/i)
assert.doesNotMatch(source, /(?:insert|update|delete|alter|drop|truncate)\s+(?:into|table|from)/i)

console.log("Preview backend one-mount recovery tests passed.")
