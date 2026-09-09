"""Hermetic adjacent rollback/security and controller-order regression tests."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("rollback_records", ROOT / "scripts/production-backend-rollback-record.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
CONTROLLER = (ROOT / "scripts/production-server-backend-deploy.sh").read_text()
CURRENT = "f31bd87a8ab12fa9f2c5cd3ef1de1fd89071746c"
PREVIOUS = "2a767ee0399e3daf91b9205b82682aec0e8296b6"
FUTURE = "a" * 40
TARGET = "harvest-api-pre-github-34244362642-20260908T152805Z"
FUTURE_TARGET = "harvest-api-pre-github-999-20260909T090000Z"
IDENTITY = "999-20260909T090000Z-" + "a" * 16
FUTURE_ID = "1000-20260909T100000Z-" + "b" * 16
RECEIPT_ID = "1001-20260909T110000Z-" + "c" * 16


def artifacts(revision, digit, *, running):
    image_id = "sha256:" + digit * 64
    env = ["MFMS_ENV=production", "MFMS_TARGET_DATABASE=mfms_server_prod", "DATABASE_URL=postgresql://test-only.invalid/mfms_server_prod", "MFMS_GIT_COMMIT=" + revision]
    item = {
        "Id": digit * 64, "Image": image_id, "Config": {"Env": env},
        "HostConfig": {"NetworkMode": "harvest-net", "PortBindings": {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8001"}]}, "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}},
        "Mounts": [{"Type": t, "Source": s, "Destination": d, "RW": rw} for t, s, d, rw in MODULE.BASE_MOUNTS],
        "State": {"Running": running}, "RestartCount": 0,
        "NetworkSettings": {"Networks": {"harvest-net": {"IPAddress": "172.19.0.2"}} if running else {}},
    }
    image = {"Id": image_id, "Config": {"Labels": {"org.opencontainers.image.revision": revision, "com.muthufarms.mfms.environment": "Production"}}}
    return item, image


class RecordTests(unittest.TestCase):
    def setUp(self):
        # Use a trusted workspace parent (not world-writable /tmp) on Linux.
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / "tests")
        self.root = Path(self.temp.name)
        self.root.chmod(0o700)
        self.live = artifacts(CURRENT, "1", running=True)
        self.previous = artifacts(PREVIOUS, "2", running=False)
        self.containers = {"harvest-api": self.live, TARGET: self.previous}
        self.records = MODULE.Records(self.root, inspect=self.inspect)
        self.records.initialize()
        self.state = {"deployed_revision": CURRENT, "deployed_image_id": self.live[0]["Image"], "deployed_image_tag": "current-tag", "rollback_container": TARGET, "rollback_revision": PREVIOUS, "rollback_image_id": self.previous[0]["Image"], "rollback_image_tag": "previous-tag", "run_id": "34244362642", "updated_at": "20260908T152805Z", "database_migrations": "forward-only"}
        MODULE.atomic_write(self.records.state_path, MODULE.state_bytes(self.state))

    def tearDown(self):
        # Windows may retain the read-only attribute when exercising immutable files.
        for item in self.root.rglob("*"):
            if item.is_file() and not item.is_symlink():
                item.chmod(0o600)
        self.temp.cleanup()

    def inspect(self, name):
        item, image = self.containers[name]
        return MODULE.snapshot(copy.deepcopy(item), copy.deepcopy(image))

    def enroll(self):
        self.records.stage(IDENTITY, CURRENT, self.live[0]["Image"], TARGET, "999", "20260909T090000Z", enrollment_hash=self.records.state()[1])
        self.records.finalize(IDENTITY, "current-tag", "previous-tag")
        self.records.activate(IDENTITY)

    def future(self):
        self.enroll()
        candidate = artifacts(FUTURE, "3", running=False)
        self.records.stage(FUTURE_ID, FUTURE, candidate[0]["Image"], FUTURE_TARGET, "1000", "20260909T100000Z")
        self.live[0]["State"]["Running"] = False
        self.live[0]["NetworkSettings"]["Networks"] = {}
        self.containers[FUTURE_TARGET] = self.live
        self.containers["harvest-api"] = candidate
        self.records.finalize(FUTURE_ID, "future-tag", "current-tag")
        candidate[0]["State"]["Running"] = True
        candidate[0]["NetworkSettings"]["Networks"] = {"harvest-net": {"IPAddress": "172.19.0.2"}}
        self.records.activate(FUTURE_ID)
        return candidate

    def test_current_and_future_adjacent_pairs_survive_new_process(self):
        self.enroll()
        self.assertEqual(self.records.verify(CURRENT)["target"]["revision"], PREVIOUS)
        # A separate Records instance has no in-transaction restoration state.
        fresh = MODULE.Records(self.root, inspect=self.inspect)
        self.assertEqual(fresh.verify(CURRENT)["status"], "ready")

    def test_synthetic_future_pair_uses_immediate_previous_release(self):
        self.future()
        self.assertEqual(self.records.verify(FUTURE)["target"]["revision"], CURRENT)
        with self.assertRaises(MODULE.Refused):
            self.records.verify(CURRENT)

    def test_prepare_precedes_activation_and_links_exact_container(self):
        self.enroll()
        candidate = artifacts(FUTURE, "3", running=True)
        self.records.stage(FUTURE_ID, FUTURE, candidate[0]["Image"], FUTURE_TARGET, "1000", "20260909T100000Z")
        self.live[0]["State"]["Running"] = False
        self.live[0]["NetworkSettings"]["Networks"] = {}
        self.containers[FUTURE_TARGET] = self.live
        self.containers["harvest-api"] = candidate
        with self.assertRaisesRegex(MODULE.Refused, "activated before"):
            self.records.finalize(FUTURE_ID, "future", "previous")

    def test_unsigned_and_tampered_record_fail_even_with_recomputed_checksum(self):
        self.enroll()
        path = self.records.path(IDENTITY, "deployment")
        raw = json.loads(path.read_text())
        raw["payload"]["previous"]["revision"] = FUTURE
        raw["signature"] = MODULE.digest(MODULE.canonical(raw["payload"]))
        path.chmod(0o600)
        path.write_bytes(MODULE.canonical(raw))
        path.chmod(0o400)
        with self.assertRaisesRegex(MODULE.Refused, "signature"):
            self.records.verify(CURRENT)

    def test_unknown_revision_missing_target_and_state_drift_reject(self):
        self.enroll()
        with self.assertRaises(MODULE.Refused):
            self.records.verify(FUTURE)
        saved = self.containers.pop(TARGET)
        with self.assertRaises(KeyError):
            self.records.verify(CURRENT)
        self.containers[TARGET] = saved
        state = self.records.state()[0]
        state["rollback_container"] = "harvest-api-pre-invented"
        MODULE.atomic_write(self.records.state_path, MODULE.state_bytes(state))
        with self.assertRaises(MODULE.Refused):
            self.records.verify(CURRENT)

    def test_actual_image_database_environment_mount_network_drift_reject(self):
        self.enroll()
        mutations = [
            lambda c, i: c.update(Id="9" * 64),
            lambda c, i: c.update(Image="sha256:" + "9" * 64),
            lambda c, i: i["Config"]["Labels"].update({"org.opencontainers.image.revision": FUTURE}),
            lambda c, i: c["Config"]["Env"].__setitem__(0, "MFMS_ENV=preview"),
            lambda c, i: c["Config"]["Env"].__setitem__(1, "MFMS_TARGET_DATABASE=mfms_server_uat"),
            lambda c, i: c["Config"]["Env"].__setitem__(2, "DATABASE_URL=postgresql://example.invalid/mfms_server_uat"),
            lambda c, i: c["Config"]["Env"].append("NEW_SECRET=test-only-change"),
            lambda c, i: c["Mounts"].append({"Type": "bind", "Source": "/", "Destination": "/host", "RW": True}),
            lambda c, i: c["HostConfig"].update(Privileged=True),
            lambda c, i: c["NetworkSettings"]["Networks"].update({"another-network": {"IPAddress": "10.0.0.8"}}),
            lambda c, i: c["NetworkSettings"]["Networks"]["harvest-net"].update(Aliases=["unreviewed-alias"]),
            lambda c, i: c["NetworkSettings"]["Networks"]["harvest-net"].update(IPAddress="172.19.0.9"),
        ]
        saved = copy.deepcopy(self.live)
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                self.containers["harvest-api"] = copy.deepcopy(saved)
                mutate(*self.containers["harvest-api"])
                with self.assertRaises(MODULE.Refused):
                    self.records.verify(CURRENT)
        self.containers["harvest-api"] = saved

    def test_stopped_source_after_workflow_remains_eligible_but_wrong_identity_does_not(self):
        candidate = self.future()
        candidate[0]["State"]["Running"] = False
        candidate[0]["RestartCount"] = 3
        self.assertEqual(self.records.verify(FUTURE)["status"], "ready")
        candidate[0]["NetworkSettings"]["Networks"] = {}
        self.assertEqual(self.records.verify(FUTURE)["status"], "ready")
        candidate[0]["Config"]["Env"].append("UNREVIEWED=change")
        with self.assertRaises(MODULE.Refused):
            self.records.verify(FUTURE)

    def test_repeated_successful_rollback_is_verified_noop_never_reverse(self):
        candidate = self.future()
        candidate[0]["State"]["Running"] = False
        candidate[0]["NetworkSettings"]["Networks"] = {}
        retained = "harvest-api-pre-rollback-1001-20260909T110000Z"
        self.containers[retained] = candidate
        self.live[0]["State"]["Running"] = True
        self.live[0]["NetworkSettings"]["Networks"] = {"harvest-net": {"IPAddress": "172.19.0.2"}}
        self.containers["harvest-api"] = self.live
        self.records.rollback_receipt(FUTURE_ID, RECEIPT_ID, retained, "1001", "20260909T110000Z")
        self.assertEqual(self.records.verify(FUTURE)["status"], "already-complete")
        with self.assertRaises(MODULE.Refused):
            self.records.verify(CURRENT)
        self.live[0]["Id"] = "9" * 64
        with self.assertRaises(MODULE.Refused):
            self.records.verify(FUTURE)

    def test_immutable_record_collision_and_tampered_preparation_reject(self):
        self.enroll()
        with self.assertRaises(FileExistsError):
            self.records.save(IDENTITY, "deployment", {})
        path = self.records.path(IDENTITY, "prepare")
        raw = json.loads(path.read_text())
        raw["payload"]["previous"]["container_id"] = "f" * 64
        path.chmod(0o600)
        path.write_bytes(MODULE.canonical(raw))
        path.chmod(0o400)
        with self.assertRaises(MODULE.Refused):
            self.records.verify(CURRENT)

    def test_duplicate_json_state_fields_and_symlinks_fail(self):
        with self.assertRaises(MODULE.Refused):
            MODULE.parse_json('{"payload":{},"payload":{}}')
        with self.assertRaises(MODULE.Refused):
            MODULE.parse_state(b"database_migrations=forward-only\ndatabase_migrations=forward-only\n")
        self.enroll()
        path = self.records.path(IDENTITY, "deployment")
        renamed = path.with_suffix(".saved")
        path.rename(renamed)
        try:
            path.symlink_to(renamed)
        except OSError:
            self.skipTest("platform does not permit unprivileged symlinks")
        with self.assertRaises(MODULE.Refused):
            self.records.verify(CURRENT)

    @unittest.skipIf(os.name == "nt", "POSIX owner/mode checks run in Linux CI")
    def test_permissions_and_lost_signing_key_fail_closed(self):
        self.enroll()
        self.records.key_path.chmod(0o644)
        with self.assertRaises(MODULE.Refused):
            self.records.verify(CURRENT)
        self.records.key_path.chmod(0o400)
        self.records.key_path.unlink()
        with self.assertRaises(MODULE.Refused):
            self.records.initialize()

    def test_legacy_enrollment_requires_exact_fresh_hash_and_never_reenrolls(self):
        with self.assertRaises(MODULE.Refused):
            self.records.stage(IDENTITY, CURRENT, self.live[0]["Image"], TARGET, "999", "20260909T090000Z", enrollment_hash="0" * 64)
        self.enroll()
        with self.assertRaises(MODULE.Refused):
            self.records.stage(FUTURE_ID, CURRENT, self.live[0]["Image"], TARGET, "1000", "20260909T100000Z", enrollment_hash=self.records.state()[1])


def shell_function(name):
    match = re.search(rf"^{name}\(\) \{{.*?^\}}", CONTROLLER, re.M | re.S)
    if not match:
        raise AssertionError("missing controller function: " + name)
    return match.group(0)


class ControllerTests(unittest.TestCase):
    def bash(self, script):
        executable = shutil.which("bash")
        if os.name == "nt":
            executable = "C:/Program Files/Git/bin/bash.exe"
        return subprocess.run([executable, "--noprofile", "--norc"], input=script, text=True, capture_output=True)

    def test_record_stage_precedes_smoke_and_final_record_precedes_activation(self):
        for name in ["deploy_backend", "credential_cutover_backend"]:
            with self.subTest(operation=name):
                function = shell_function(name)
                self.assertLess(function.index("stage_backend_rollback_record"), function.index("start_candidate"))
                self.assertLess(function.index("docker create"), function.index("rollback_record finalize"))
                self.assertLess(function.index("rollback_record finalize"), function.index('docker start "$backend_live_container"'))
                self.assertLess(function.index("rollback_record activate"), function.index("transaction_active=0"))

    def test_rollback_and_dry_run_share_pair_check_after_workflow(self):
        for name in ["rollback_backend", "dry_run_backend_rollback"]:
            self.assertIn("assert_adjacent_application_rollback", shell_function(name))
        self.assertNotIn("assert_exact_historical_application_rollback", CONTROLLER)
        self.assertIn('flock -n 9 || blocked', CONTROLLER)
        self.assertIn('rollback_status" == "already-complete', shell_function("rollback_backend"))

    def test_early_validation_failure_cannot_be_masked_by_later_success(self):
        base = '''set +e
blocked() { echo "BLOCKED: $*"; return 1; }
container_exists() { return 0; }
container_running() { return 0; }
docker() { case "$*" in *".Image"*) echo wrong-image;; *) echo ignored;; esac; }
backend_live_container=harvest-api
'''
        result = self.bash(base + shell_function("assert_live_contract") + '\nassert_live_contract revision expected-image || exit 7\necho UNSAFE_PASS\n')
        self.assertEqual(result.returncode, 7, result.stdout + result.stderr)
        self.assertNotIn("UNSAFE_PASS", result.stdout)

    def test_controller_actual_rollback_and_repeat_execute_only_exact_adjacent_pair(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            folder = Path(directory).as_posix()
            # Only the extracted function runs. Every Docker and database surface
            # is replaced by an in-process shell fake; no live controller runs.
            for status in ["ready", "already-complete"]:
                trace = Path(directory) / (status + ".trace")
                harness = f'''set -e
trace='{trace.as_posix()}'
: > "$trace"
state_file='{folder}/state'
rollback_database_before='{folder}/db.before'
rollback_database_after='{folder}/db.after'
environment_file='{folder}/fake.env'
touch "$state_file"
backend_live_container=harvest-api
expected_current_revision={CURRENT}
original_revision={CURRENT}
original_image_id=current-image
production_url=https://muthufarms.com
approved_production_ipv4=172.19.0.2
run_id=1001
timestamp=20260909T110000Z
deployment_id={IDENTITY}
blocked() {{ echo "BLOCKED: $*"; return 1; }}
validate_common_live_state() {{ :; }}
assert_adjacent_application_rollback() {{ rollback_status={status}; }}
snapshot_rollback_database_evidence() {{ printf 'same-read-only-evidence\\n' > "$2"; }}
read_state_value() {{ case "$1" in deployed_revision) echo {CURRENT};; deployed_image_id) echo current-image;; deployed_image_tag) echo current-tag;; rollback_container) echo {TARGET};; rollback_revision) echo {PREVIOUS};; rollback_image_id) echo target-image;; rollback_image_tag) echo target-tag;; esac; }}
container_exists() {{ return 0; }}
container_running() {{ return 1; }}
image_revision_for_container() {{ echo {PREVIOUS}; }}
docker() {{ echo "docker $*" >> "$trace"; case "$*" in *".Config.Env"*) printf '["TEST_ONLY=value"]\\n';; *".Image"*) echo target-image;; esac; }}
python3() {{ command '{Path(os.sys.executable).as_posix()}' "$@"; }}
assert_candidate_port_available() {{ :; }}
start_candidate() {{ echo candidate >> "$trace"; }}
assert_database_target() {{ :; }}
remove_candidate() {{ :; }}
disconnect_production_network() {{ :; }}
ensure_production_network_ip() {{ :; }}
assert_live_contract() {{ echo protected-check >> "$trace"; }}
new_deployment_id() {{ echo {RECEIPT_ID}; }}
rollback_record() {{ echo "record $*" >> "$trace"; }}
'''
                result = self.bash(harness + shell_function("rollback_backend") + "\nrollback_backend\n")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn("PRODUCTION_BACKEND_ROLLBACK=PASS", result.stdout)
                operations = trace.read_text()
                if status == "already-complete":
                    self.assertEqual(operations, "")
                else:
                    self.assertIn(f"docker rename {TARGET} harvest-api", operations)
                    self.assertLess(operations.index("protected-check"), operations.index("record receipt"))
                    self.assertNotRegex(operations, r"migrat|pg_dump|pg_restore")

    def test_failure_restores_prior_state_and_cannot_report_pass_on_contract_failure(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            folder = Path(directory).as_posix()
            for validation in ["false", "true"]:
                old = Path(directory) / "before"
                active = Path(directory) / "state"
                old.write_text("original-state\n")
                active.write_text("new-state\n")
                harness = f'''set +e
backend_live_container=harvest-api
original_container_id=original-id
original_image_id=original-image
original_revision={CURRENT}
deployment_id={IDENTITY}
operation=deploy
transaction_backup=''
state_dir='{folder}'
previous_state='{old.as_posix()}'
state_file='{active.as_posix()}'
approved_production_ipv4=172.19.0.2
container_exists() {{ return 0; }}
docker() {{ echo original-id; }}
ensure_production_network_ip() {{ return 0; }}
assert_live_contract() {{ {validation}; }}
rollback_record() {{ return 0; }}
'''
                result = self.bash(harness + shell_function("restore_original_backend") + '\nrestore_original_backend || true\necho "RESTORE=$automatic_restore_result"\n')
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(active.read_text(), "original-state\n")
                self.assertIn("RESTORE=" + ("pass" if validation == "true" else "failed"), result.stdout)

    def test_shell_lock_prevents_concurrent_mutation(self):
        if os.name == "nt":
            self.skipTest("flock integration runs on Linux CI")
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            path = str(Path(directory) / "lock")
            script = 'exec 9>"$1"\nflock -n 9 || exit 7\nprintf "locked\\n"\nread -r stop\n'
            holder = subprocess.Popen(["bash", "-c", script, "lock-test", path], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
            try:
                self.assertEqual(holder.stdout.readline().strip(), "locked")
                refused = subprocess.run(["flock", "-n", path, "true"], capture_output=True)
                self.assertNotEqual(refused.returncode, 0)
            finally:
                holder.communicate("stop\n", timeout=5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
