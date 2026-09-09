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
from unittest import mock
import hashlib
import sys


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("rollback_records", ROOT / "scripts/production-frontend-rollback-record.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
CONTROLLER = (ROOT / "scripts/production-server-deploy.sh").read_text()
CURRENT = "de98369d1c8e4e0b4cfe8bf7006d30df2c3cb8f6"
PREVIOUS = "9b63ab23165786495a38241f455f868f56043bec"
FUTURE = "a" * 40
TARGET = "mfms-v0-preview-web-pre-github-34244362642-20260908T152805Z"
FUTURE_TARGET = "mfms-v0-preview-web-pre-github-999-20260909T090000Z"
IDENTITY = "999-20260909T090000Z-" + "a" * 16
FUTURE_ID = "1000-20260909T100000Z-" + "b" * 16
RECEIPT_ID = "1001-20260909T110000Z-" + "c" * 16


def artifacts(revision, digit, *, running):
    image_id = "sha256:" + digit * 64
    env = ["NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL=mfms_server_prod", "HARVEST_API_BASE_URL=http://harvest-api:8000", "MFMS_ENV=production", "MFMS_TARGET_DATABASE=mfms_server_prod", "DATABASE_URL=postgresql://test-only.invalid/mfms_server_prod", "MFMS_GIT_COMMIT=" + revision]
    item = {
        "Id": digit * 64, "Image": image_id, "Config": {"Env": env},
        "HostConfig": {"NetworkMode": "harvest-net", "PortBindings": {"3000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "3014"}]}, "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}},
        "Mounts": [{"Type": t, "Source": s, "Destination": d, "RW": rw} for t, s, d, rw in []],
        "State": {"Running": running}, "RestartCount": 0,
        "NetworkSettings": {"Networks": {"harvest-net": {"IPAddress": "172.19.128.7"}} if running else {}},
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
        self.containers = {"mfms-v0-preview-web": self.live, TARGET: self.previous}
        self.records = MODULE.Records(self.root, inspect=self.inspect)
        self.records.initialize()
        self.state = {"deployed_revision": CURRENT, "deployed_image_id": self.live[0]["Image"], "deployed_image_tag": "current-tag", "rollback_container": TARGET, "rollback_revision": PREVIOUS, "rollback_image_id": self.previous[0]["Image"], "rollback_image_tag": "previous-tag", "run_id": "34244362642", "updated_at": "20260908T152805Z"}
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
        self.containers["mfms-v0-preview-web"] = candidate
        self.records.finalize(FUTURE_ID, "future-tag", "current-tag")
        candidate[0]["State"]["Running"] = True
        candidate[0]["NetworkSettings"]["Networks"] = {"harvest-net": {"IPAddress": "172.19.128.7"}}
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
        self.containers["mfms-v0-preview-web"] = candidate
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
        state["rollback_container"] = "mfms-v0-preview-web-pre-invented"
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
                self.containers["mfms-v0-preview-web"] = copy.deepcopy(saved)
                mutate(*self.containers["mfms-v0-preview-web"])
                with self.assertRaises(MODULE.Refused):
                    self.records.verify(CURRENT)
        self.containers["mfms-v0-preview-web"] = saved

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

    def test_captured_live_and_retained_docker_endpoint_defaults(self):
        # Exact frontend endpoint/container/image metadata captured 2026-09-09.
        # Environment values are synthetic; no live credential data is included.
        endpoint = {'IPAMConfig': {'IPv4Address': '172.19.128.7', 'IPv6Address': ''}, 'Links': None, 'Aliases': None, 'DriverOpts': None, 'GwPriority': 0, 'NetworkID': '6327f4a8da1cd862d74776049e808fbd4cd1a2125055d73f7db42382a368005f', 'EndpointID': 'febabeb3f0cea5868dc9ec6e10219a6e107f98d6a47f0fc7b762452eba244b84', 'Gateway': '172.19.0.1', 'IPAddress': '172.19.128.7', 'MacAddress': 'a6:6f:d5:42:84:53', 'IPPrefixLen': 16, 'IPv6Gateway': '', 'GlobalIPv6Address': '', 'GlobalIPv6PrefixLen': 0, 'DNSNames': ['mfms-v0-preview-web', 'c6f21756d0b7']}
        network = {"Name": "harvest-net", "Driver": "bridge", "Id": endpoint["NetworkID"], "IPAM": {"Config": [{"Subnet": "172.19.0.0/16", "IPRange": "172.19.128.0/17", "Gateway": "172.19.0.1"}]}}
        self.live[0]["Id"] = "c6f21756d0b79e83606c463df6982646f04bd1be16394c88a2382718e2ea8fdd"
        self.live[0]["Image"] = self.live[1]["Id"] = "sha256:959b8467a5886de2dbad948261ecf66a7581c9f3c2325b84f94d7e9a2d3f06f9"
        self.live[0]["NetworkSettings"]["Networks"] = {"harvest-net": endpoint}
        self.previous[0]["Id"] = "27ecccba908aca7208a7b7ff60b8cd0e78d24712b076e0c1ef1220065375c8f2"
        self.previous[0]["Image"] = self.previous[1]["Id"] = "sha256:c501296be0f7587bb1a83462e3935365bc57b4cb35ec797746a766af784f6324"
        self.previous[0]["NetworkSettings"]["Networks"] = {}
        captured = MODULE.snapshot(*self.live, network)
        self.assertEqual(captured["ip"], "172.19.128.7")
        self.assertEqual(MODULE.snapshot(*self.previous, network)["ip"], "")
        for empty in [None, []]:
            endpoint["IPAMConfig"]["LinkLocalIPs"] = empty
            self.assertEqual(MODULE.snapshot(*self.live, network), captured)
        for invalid in [
            {"IPv6Address": "fd00::2"}, {"IPv6Address": None}, {"IPv6Address": False},
            {"LinkLocalIPs": ["169.254.1.2"]}, {"LinkLocalIPs": ["fe80::2"]},
            {"LinkLocalIPs": ""}, {"LinkLocalIPs": False}, {"LinkLocalIPs": {}},
            {"IPv4Address": "172.19.0.3"}, {"UnknownOption": ""},
        ]:
            with self.subTest(invalid=invalid):
                endpoint["IPAMConfig"] = {"IPv4Address": "172.19.128.7", "IPv6Address": "", **invalid}
                with self.assertRaises(MODULE.Refused):
                    MODULE.snapshot(*self.live, network)

    def test_repeated_successful_rollback_is_verified_noop_never_reverse(self):
        candidate = self.future()
        candidate[0]["State"]["Running"] = False
        candidate[0]["NetworkSettings"]["Networks"] = {}
        retained = "mfms-v0-preview-web-pre-rollback-1001-20260909T110000Z"
        self.containers[retained] = candidate
        self.live[0]["State"]["Running"] = True
        self.live[0]["NetworkSettings"]["Networks"] = {"harvest-net": {"IPAddress": "172.19.128.7"}}
        self.containers["mfms-v0-preview-web"] = self.live
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
    if not match: raise AssertionError(name)
    return match.group(0)


class FrontendControllerTests(unittest.TestCase):
    def bash(self, script):
        executable = "C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash")
        return subprocess.run([executable, "--noprofile", "--norc"], input=script, text=True, capture_output=True)

    def test_records_precede_every_activation(self):
        deploy = shell_function("deploy_production")
        self.assertLess(deploy.index("frontend_record stage"), deploy.index("start_candidate"))
        self.assertLess(deploy.index("docker create"), deploy.index("frontend_record finalize"))
        self.assertLess(deploy.index("frontend_record finalize"), deploy.index('docker start "$live_container"'))
        self.assertLess(deploy.index("frontend_record activate"), deploy.index("transaction_active=0"))
        self.assertNotIn("write_state", deploy)
        self.assertIn("frontend_record receipt", shell_function("rollback_production"))
        self.assertIn("verify_frontend_rollback", shell_function("dry_run_frontend_rollback"))

    def test_post_workflow_rollback_of_healthy_or_stopped_source(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            state = Path(directory) / "state"
            state.write_text("fixture")
            for running in [True, False]:
                harness = f'''set -euo pipefail
state_file='{state.as_posix()}'
environment_file='{(Path(directory) / "env").as_posix()}'
live_container=mfms-v0-preview-web
production_url=https://muthufarms.com
production_network=harvest-net
original_network_ip=172.19.128.7
expected_current_revision={'a'*40}
original_revision={'a'*40}
original_image_id=sha256:{'1'*64}
run_id=123
timestamp=20260909T120000Z
live_port=3014
before_unrelated=fixture
public_guard_result=PASS
verify_frontend_rollback() {{ rollback_status=ready; deployment_id=fixture; }}
validate_common_live_state() {{ :; }}
blocked() {{ echo BLOCKED; return 1; }}
read_state_value() {{ case "$1" in
 deployed_revision) echo {'a'*40};; deployed_image_id) echo sha256:{'1'*64};;
 rollback_revision) echo {'b'*40};; rollback_image_id) echo sha256:{'2'*64};;
 rollback_container) echo mfms-v0-preview-web-pre-github-100-20260909T110000Z;;
 *) echo fixture-tag;; esac; }}
container_exists() {{ return 0; }}
container_running() {{ [[ "$1" == "$live_container" && "{str(running).lower()}" == true ]]; }}
image_revision_for_container() {{ echo {'b'*40}; }}
start_candidate() {{ echo SMOKE; }}
remove_candidate() {{ :; }}
disconnect_production_network() {{ :; }}
ensure_production_network_ip() {{ :; }}
announce_production_network_identity() {{ :; }}
wait_for_version() {{ :; }}
smoke_routes() {{ :; }}
wait_for_public_production_guard() {{ :; }}
assert_live_contract() {{ [[ "$1" == {'b'*40} && "$2" == sha256:{'2'*64} ]]; }}
frontend_record() {{ [[ "$1" == receipt ]]; echo SIGNED_RECEIPT; }}
new_deployment_id() {{ echo fixture-receipt; }}
docker() {{ case "$1" in inspect) if [[ "$3" == *Config.Env* ]];then echo '[]';else echo sha256:{'2'*64};fi;; stop) echo STOP_SOURCE >&2;; *) :;; esac; }}
'''
                result = self.bash(harness + shell_function("rollback_production") + "\nrollback_production\n")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn("SIGNED_RECEIPT", result.stdout)
                self.assertIn("PRODUCTION_ROLLBACK=PASS", result.stdout)
                self.assertEqual("STOP_SOURCE" in result.stderr, running)

    def test_retained_target_rename_collision_never_deletes_signed_artifact(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            trace = Path(directory) / "trace"
            harness = f'''set +e
live_container=mfms-v0-preview-web
original_container_id=original
replacement_origin=mfms-v0-preview-web-pre-github-100-20260909T110000Z
transaction_backup=original-backup
trace='{trace.as_posix()}'
container_exists() {{ return 0; }}
disconnect_production_network() {{ return 0; }}
docker() {{ echo "$1" >> "$trace"; case "$1" in inspect) echo retained-target;; rename) return 1;; esac; }}
'''
            result = self.bash(harness + shell_function("restore_original_frontend") + "\nrestore_original_frontend || exit 7\n")
            self.assertEqual(result.returncode, 7)
            self.assertIn("rename", trace.read_text())
            self.assertNotIn("rm", trace.read_text().splitlines())

    def test_target_contract_requires_running_even_for_rollback(self):
        harness = "set +e\nlive_container=fixture\noperation=rollback\nrollback_source_allowed=1\ncontainer_exists() { return 0; }\ncontainer_running() { return 1; }\nblocked() { return 1; }\n"
        result = self.bash(harness + shell_function("assert_live_contract") + "\nassert_live_contract a b c || exit 7\necho UNSAFE\n")
        self.assertEqual(result.returncode, 7)
        self.assertNotIn("UNSAFE", result.stdout)

    def test_public_identity_and_backend_url_are_not_interchangeable(self):
        for key, value in [("NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL", "mfms_server_uat"), ("HARVEST_API_BASE_URL", "http://harvest-api-pilot:8000"), ("HARVEST_API_BASE_URL", "http://user@harvest-api:8000"), ("HARVEST_API_BASE_URL", "http://harvest-api:8000/other")]:
            item, image = artifacts(CURRENT, "1", running=True)
            item["Config"]["Env"] = [entry for entry in item["Config"]["Env"] if not entry.startswith(key + "=")] + [key + "=" + value]
            with self.assertRaises(MODULE.Refused): MODULE.snapshot(item, image)


if __name__ == "__main__":
    unittest.main(verbosity=2)
