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
        "HostConfig": {"OomKillDisable": False, "NetworkMode": "harvest-net", "PortBindings": {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8001"}]}, "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}},
        "Mounts": [{"Type": t, "Source": s, "Destination": d, "RW": rw} for t, s, d, rw in MODULE.BASE_MOUNTS],
        "State": {"Running": running, "Paused": False, "Restarting": False, "Dead": False}, "RestartCount": 0,
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
        result = MODULE.snapshot(copy.deepcopy(item), copy.deepcopy(image))
        # This record-only adapter never inspects Docker. Raw lifecycle/endpoint
        # proof is independently exercised by the network-state fixtures.
        result["production_address_owners"] = sorted({value[0]["Id"] for value in self.containers.values()
                                                     if value[0]["State"]["Running"] is True})
        return result

    def test_signed_transition_role_and_lifecycle_are_exact(self):
        self.enroll()
        self.records.transition_ready(IDENTITY, "rollback", "source", "harvest-api", "true")
        for role, name, running in (("target", "harvest-api", "true"), ("source", TARGET, "false"),
                                    ("source", "harvest-api", "false"), ("target", TARGET, "false")):
            with self.subTest(role=role, name=name, running=running), self.assertRaises(MODULE.Refused):
                self.records.transition_ready(IDENTITY, "rollback", role, name, running)
        self.live[0]["State"]["Running"] = False
        self.live[0]["NetworkSettings"]["Networks"] = {}
        self.records.transition_ready(IDENTITY, "rollback", "source", "harvest-api", "false")
        self.records.transition_ready(IDENTITY, "rollback", "target", TARGET, "false")

    def test_preflight_fingerprint_binds_full_config_and_exact_original(self):
        item, image = copy.deepcopy(self.live)
        network = {"Name": "harvest-net", "Driver": "bridge", "Id": "a" * 64,
                   "IPAM": {"Config": [{"Subnet": "172.19.0.0/16", "IPRange": "172.19.128.0/17", "Gateway": "172.19.0.1"}]},
                   "Containers": {item["Id"]: {"IPv4Address": "172.19.0.2/16", "EndpointID": "b" * 64}}}
        item["NetworkSettings"]["Networks"]["harvest-net"].update(
            NetworkID=network["Id"], EndpointID="b" * 64, IPAMConfig={"IPv4Address": "172.19.0.2"})
        def capture(value, identity=item["Id"], image_id=item["Image"], revision=CURRENT):
            return MODULE.source_fingerprint(value, image, network, {value["Id"]: value}, identity, image_id, revision)
        baseline = capture(item)
        reordered = copy.deepcopy(item)
        reordered["Mounts"].reverse()
        self.assertEqual(capture(reordered), baseline)
        for mutate in (lambda x: x["Config"].update(Cmd=["changed"]),
                       lambda x: x["Config"].update(Entrypoint=["changed"]),
                       lambda x: x["Config"]["Env"].reverse(),
                       lambda x: x["Mounts"][0].update(UnknownStableField="changed"),
                       lambda x: x["HostConfig"].update(UnknownStableField="changed")):
            changed = copy.deepcopy(item)
            mutate(changed)
            self.assertNotEqual(capture(changed), baseline)
        for identity, image_id, revision in (("f" * 64, item["Image"], CURRENT),
                                            (item["Id"], "sha256:" + "f" * 64, CURRENT),
                                            (item["Id"], item["Image"], FUTURE)):
            with self.assertRaises(MODULE.Refused):
                capture(item, identity, image_id, revision)

    def test_signed_owner_cardinality_and_lifecycle_cannot_be_waived(self):
        self.enroll()
        self.records.restore_ready(IDENTITY, "rollback", "harvest-api")
        self.records.replacement_ready(IDENTITY, "rollback", TARGET)
        original = self.inspect
        for owners in (["f" * 64], [self.live[0]["Id"], self.previous[0]["Id"]],
                       [self.live[0]["Id"], self.live[0]["Id"]], [], None):
            def altered(name, owners=owners):
                result = original(name)
                result["production_address_owners"] = owners
                return result
            with self.subTest(owners=owners), mock.patch.object(self.records, "inspect", altered):
                with self.assertRaises(MODULE.Refused):
                    self.records.restore_ready(IDENTITY, "rollback", "harvest-api")

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

    def test_real_first_start_oom_transition_preserves_signed_record_bytes(self):
        self.enroll()
        candidate = artifacts(FUTURE, "3", running=False)
        self.records.stage(FUTURE_ID, FUTURE, candidate[0]["Image"], FUTURE_TARGET, "1000", "20260909T100000Z")
        self.live[0]["State"]["Running"] = False
        self.live[0]["NetworkSettings"]["Networks"] = {}
        self.containers[FUTURE_TARGET] = self.live
        self.containers["harvest-api"] = candidate
        self.records.finalize(FUTURE_ID, "future-tag", "current-tag")
        path = self.records.path(FUTURE_ID, "deployment")
        signed_before = path.read_bytes()
        recorded = self.records.deployment(FUTURE_ID)[0]["current"]
        candidate[0]["State"]["Running"] = True
        candidate[0]["NetworkSettings"]["Networks"] = {"harvest-net": {"IPAddress": "172.19.0.2"}}
        candidate[0]["HostConfig"]["OomKillDisable"] = None
        # The old exact raw-hash check rejects the demonstrated Docker transition.
        self.assertNotEqual(self.inspect("harvest-api")["static"], recorded)
        self.records.activate(FUTURE_ID)
        self.assertEqual(path.read_bytes(), signed_before)
        self.assertEqual(self.records.verify(FUTURE)["status"], "ready")
        with self.assertRaises(MODULE.Refused):
            self.records.activate(FUTURE_ID)

    def test_oom_compatibility_rejects_other_changes_and_wrong_types(self):
        candidate = self.future()
        candidate[0]["HostConfig"]["OomKillDisable"] = None
        self.assertEqual(self.records.verify(FUTURE)["status"], "ready")
        for key, value in (("FutureUnreviewedField", False), ("Memory", 128), ("OomKillDisable", True),
                           ("OomKillDisable", 0), ("OomKillDisable", "false"), ("OomKillDisable", [])):
            with self.subTest(key=key, value=value):
                saved = copy.deepcopy(candidate[0]["HostConfig"])
                candidate[0]["HostConfig"][key] = value
                with self.assertRaises(MODULE.Refused):
                    self.records.verify(FUTURE)
                candidate[0]["HostConfig"] = saved
        del candidate[0]["HostConfig"]["OomKillDisable"]
        with self.assertRaises(MODULE.Refused):
            self.records.verify(FUTURE)

    def test_oom_compatibility_is_directional_and_full_hash_bound(self):
        item, image = artifacts(CURRENT, "1", running=True)
        item["HostConfig"]["OomKillDisable"] = None
        after = MODULE.snapshot(item, image)
        item["HostConfig"]["OomKillDisable"] = False
        before = MODULE.snapshot(item, image)
        MODULE.Records.match(after, before["static"], running=True)
        with self.assertRaises(MODULE.Refused):
            MODULE.Records.match(before, after["static"], running=True)
        expected = dict(before["static"], host_config_sha256="0" * 64)
        with self.assertRaises(MODULE.Refused):
            MODULE.Records.match(after, expected, running=True)

    def test_restore_ready_validates_signed_artifact_before_start(self):
        self.enroll()
        self.records.stage(FUTURE_ID, FUTURE, "sha256:" + "3" * 64, FUTURE_TARGET, "1000", "20260909T100000Z")
        self.live[0]["State"]["Running"] = False
        self.live[0]["NetworkSettings"]["Networks"] = {}
        self.records.restore_ready(FUTURE_ID, "deploy", "harvest-api")
        self.live[0]["HostConfig"]["Memory"] = 42
        with self.assertRaises(MODULE.Refused):
            self.records.restore_ready(FUTURE_ID, "deploy", "harvest-api")

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

    def test_captured_live_and_retained_docker_endpoint_defaults(self):
        # Sanitized Production inspection captured 2026-09-09: metadata only.
        # Credentials/environment values are deliberately absent from this fixture.
        endpoint = {
            "Aliases": None, "DNSNames": ["harvest-api", "05fb88f88251"], "DriverOpts": None,
            "EndpointID": "126b038f907e1f33a82abb9118de48a34b39778771cad0192d866dbdf37f4296",
            "Gateway": "172.19.0.1", "GlobalIPv6Address": "", "GlobalIPv6PrefixLen": 0, "GwPriority": 0,
            "IPAMConfig": {"IPv4Address": "172.19.0.2", "IPv6Address": ""},
            "IPAddress": "172.19.0.2", "IPPrefixLen": 16, "IPv6Gateway": "", "Links": None,
            "MacAddress": "3e:fd:2d:68:40:70",
            "NetworkID": "6327f4a8da1cd862d74776049e808fbd4cd1a2125055d73f7db42382a368005f",
        }
        network = {"Name": "harvest-net", "Driver": "bridge", "Id": endpoint["NetworkID"], "IPAM": {"Config": [{"Subnet": "172.19.0.0/16", "IPRange": "172.19.128.0/17", "Gateway": "172.19.0.1"}]},
                   "Containers": {"05fb88f88251cc79954f9212b07e6484c71c15c6e21da74445122292f5d0c4fe": {
                       "Name": "harvest-api", "EndpointID": endpoint["EndpointID"], "IPv4Address": "172.19.0.2/16",
                       "IPv6Address": "", "MacAddress": endpoint["MacAddress"]}}}
        self.live[0]["Id"] = "05fb88f88251cc79954f9212b07e6484c71c15c6e21da74445122292f5d0c4fe"
        self.live[0]["NetworkSettings"]["Networks"] = {"harvest-net": endpoint}
        self.previous[0]["Id"] = "b7de813c314274c043fb4e5f5220ad764a5dbda034fe233c3936fdcdf080b09a"
        self.previous[0]["NetworkSettings"]["Networks"] = {}
        captured = MODULE.snapshot(*self.live, network)
        self.assertEqual(captured["ip"], "172.19.0.2")
        self.assertEqual(MODULE.snapshot(*self.previous, network, owner_items={self.live[0]["Id"]: self.live[0]})["ip"], "")
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
                endpoint["IPAMConfig"] = {"IPv4Address": "172.19.0.2", "IPv6Address": "", **invalid}
                with self.assertRaises(MODULE.Refused):
                    MODULE.snapshot(*self.live, network)

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

    def test_intelligence_future_pair_retains_legacy_target_and_rejects_downgrade(self):
        self.enroll()
        candidate = artifacts(FUTURE, "3", running=False)
        candidate[0]["Config"]["Env"] += [key + "=" + value for key, value in MODULE.INTELLIGENCE_ENVIRONMENT.items()]
        candidate[0]["Mounts"] = [{"Type": t, "Source": source, "Destination": target, "RW": rw} for t, source, target, rw in MODULE.INTELLIGENCE_MOUNTS]
        self.records.stage(FUTURE_ID, FUTURE, candidate[0]["Image"], FUTURE_TARGET, "1000", "20260909T100000Z")
        self.live[0]["State"]["Running"] = False
        self.live[0]["NetworkSettings"]["Networks"] = {}
        self.containers[FUTURE_TARGET] = self.live
        self.containers["harvest-api"] = candidate
        self.records.finalize(FUTURE_ID, "future-tag", "current-tag")
        candidate[0]["State"]["Running"] = True
        candidate[0]["NetworkSettings"]["Networks"] = {"harvest-net": {"IPAddress": "172.19.0.2"}}
        self.records.activate(FUTURE_ID)
        plan = self.records.verify(FUTURE)
        self.assertEqual(plan["target"]["mount_policy"], "production-backend-base-v1")
        # Both mount and env can form another approved profile, but cannot replace the signed source.
        candidate[0]["Config"]["Env"] = [v for v in candidate[0]["Config"]["Env"] if not v.startswith("MFMS_INTELLIGENCE_")]
        candidate[0]["Mounts"] = [{"Type": t, "Source": source, "Destination": target, "RW": rw} for t, source, target, rw in MODULE.BASE_MOUNTS]
        with self.assertRaises(MODULE.Refused):
            self.records.verify(FUTURE)

    def test_intelligence_mount_environment_and_database_overrides_fail_closed(self):
        baseline = artifacts(FUTURE, "3", running=False)
        baseline[0]["Config"]["Env"] += [key + "=" + value for key, value in MODULE.INTELLIGENCE_ENVIRONMENT.items()]
        baseline[0]["Mounts"] = [{"Type": t, "Source": source, "Destination": target, "RW": rw} for t, source, target, rw in MODULE.INTELLIGENCE_MOUNTS]
        self.assertEqual(MODULE.snapshot(*baseline)["static"]["mount_policy"], "production-intelligence-v1")
        for mutation in ["writable", "missing", "wrong-source", "preview-identity", "database-query"]:
            with self.subTest(mutation=mutation):
                item, image = copy.deepcopy(baseline)
                key_mount = next(m for m in item["Mounts"] if m["Destination"] == MODULE.INTELLIGENCE_KEY_TARGET)
                if mutation == "writable": key_mount["RW"] = True
                if mutation == "missing": item["Mounts"].remove(key_mount)
                if mutation == "wrong-source": key_mount["Source"] += ".preview"
                if mutation == "preview-identity": item["Config"]["Env"] = [v.replace("mfms-production-backend", "mfms-preview-backend") for v in item["Config"]["Env"]]
                if mutation == "database-query": item["Config"]["Env"] = [v + "?dbname=mfms_server_uat" if v.startswith("DATABASE_URL=") else v for v in item["Config"]["Env"]]
                with self.assertRaises(MODULE.Refused): MODULE.snapshot(item, image)

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

    def test_application_only_never_calls_backup_or_apply_and_verify_failure_stops(self):
        # Execute the actual pre-activation deploy body under its real direct set-e context.
        function = shell_function("deploy_backend").split('  transaction_backup=', 1)[0] + "}"
        for mode, result, expected in [("application-only", 0, "verify"), ("application-only", 1, "verify"), ("forward-only-migrations", 0, "backup\napply"), ("forward-only-migrations", 1, "backup"), ("invalid", 0, "")]:
            with self.subTest(mode=mode, result=result):
                harness = f"set -euo pipefail\ndeployment_mode={mode}\nbackend_live_container=fixture\ncandidate_revision=fixture\nverify_migrations() {{ echo verify; return {result}; }}\ncreate_production_database_backup() {{ echo backup; return {result}; }}\napply_migrations() {{ echo apply; }}\nblocked() {{ return 1; }}\n"
                for name in ["validate_common_live_state", "assert_candidate_port_available", "prepare_backend_source", "validate_release_descriptor", "build_image", "select_candidate_mounts", "write_application_only_environment", "write_environment_file"]:
                    harness += name + "() { :; }\n"
                actual = self.bash(harness + function + "\ndeploy_backend\n")
                self.assertEqual(actual.stdout.strip(), expected)
                self.assertEqual(actual.returncode == 0, mode != "invalid" and result == 0)

    def test_verify_invocation_rejects_empty_plan_and_any_failed_read(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            plan = Path(directory) / "plan"
            for contents, status, expected_calls in [("", 0, 0), ("a|b\nc|d\n", 0, 2), ("a|b\nc|d\n", 7, 1)]:
                plan.write_text(contents)
                harness = f"set +e\nmigration_plan='{plan.as_posix()}'\nproduction_network=fixture\nenvironment_file=fixture\nnew_image=fixture\nblocked() {{ return 1; }}\ndocker() {{ [[ \"$*\" == *--verify ]] || exit 99; echo verify; return {status}; }}\n"
                harness += "assert_preflight_source_ownership() { return 0; }\n"
                result = self.bash(harness + shell_function("docker_run_with_source_ownership") + "\n" + shell_function("verify_migrations") + "\nverify_migrations || exit 7\n")
                self.assertEqual(result.stdout.count("verify"), expected_calls)
                self.assertEqual(result.returncode == 0, bool(contents) and status == 0)

    def test_runner_guard_preserves_arguments_error_and_direct_errexit(self):
        for failure_guard, docker_status, expected in ((1, 0, (1, 0, 1)), (0, 7, (7, 1, 2)),
                                                      (2, 0, (1, 1, 2)), (0, 0, (0, 1, 2))):
            with self.subTest(failure_guard=failure_guard, docker_status=docker_status):
                script = f'''set -euo pipefail
guards=0
assert_preflight_source_ownership() {{ guards=$((guards+1)); echo GUARD >&2; [[ "$guards" != {failure_guard} ]]; }}
docker() {{
  [[ "$#" == 6 && "$1" == run && "$2" == --rm && "$3" == --network && "$4" == fixture && "$5" == image && "$6" == 'argument with spaces' ]] || return 99
  echo RUN >&2
  return {docker_status}
}}
'''
                script += shell_function("docker_run_with_source_ownership")
                script += "\ndocker_run_with_source_ownership --rm --network fixture image 'argument with spaces'\necho CONTINUED\n"
                result = self.bash(script)
                self.assertEqual((result.returncode, result.stderr.count("RUN"), result.stderr.count("GUARD")), expected,
                                 result.stdout + result.stderr)
                self.assertEqual("CONTINUED" in result.stdout, expected[0] == 0)

    def test_candidate_mount_selection_uses_each_exact_recorded_profile(self):
        for contract, expected in [("base", ""), ("intelligence", "readonly"), ("wrong", None)]:
            harness = f"set -euo pipefail\nexpected_mount_contract=base\nintelligence_mount_contract=intelligence\nintelligence_key_source=/approved/key\nintelligence_key_target=/run/secrets/key\nmount_contract_for_container() {{ echo {contract}; }}\nvalidate_intelligence_key_file() {{ return 0; }}\nblocked() {{ return 1; }}\n"
            functions = shell_function("assert_approved_mount_contract") + "\n" + shell_function("select_candidate_mounts")
            result = self.bash(harness + functions + '\nselect_candidate_mounts target\nprintf "%s" "${candidate_extra_mount_args[*]}"\n')
            self.assertEqual(result.returncode == 0, expected is not None)
            if expected: self.assertIn(expected, result.stdout)
            if expected == "": self.assertEqual(result.stdout, "")

    def test_application_only_descriptor_preserves_exact_migrations_and_runner(self):
        code = CONTROLLER.split("validate_release_descriptor() {", 1)[1].split("\nbuild_image() {", 1)[0].split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            root = Path(directory)
            (root / "db/migrations").mkdir(parents=True)
            migrations = []
            for index in range(13):
                relative = f"db/migrations/20260909_{index}.sql"
                content = f"-- immutable fixture {index}\n".encode()
                (root / relative).write_bytes(content)
                migrations.append({"path": relative, "sha256": hashlib.sha256(content).hexdigest()})
            descriptor = {"schema_version": 1, "environment": "Production", "target_database": "mfms_server_prod", "repository": "ayemuthu1963-beep/muthu-harvest-dashboard", "release_branch": "production-release", "deployment_kind": "backend-application-only", "runtime_profile": "production-intelligence-v1", "migrations": migrations, "required_openapi_paths": ["/health", "/api/intelligence/ask"], "protected_invariants": dict(database="read-only-verification-only", frontend="unchanged", odk="unchanged", schedules="unchanged", proxy_configuration="unchanged", test="unchanged", preview="unchanged")}
            path = root / "descriptor.json"
            args = ["controller", str(path), str(root), CURRENT, FUTURE, str(root / "migrations.plan"), str(root / "openapi.plan"), "application-only"]
            for case in ["valid", "wrong-mode", "wrong-profile", "new-pin", "missing-pin", "checksum", "runner", "sql", "missing-intelligence", "missing-core"]:
                with self.subTest(case=case):
                    data = copy.deepcopy(descriptor)
                    argv = args.copy()
                    changed = "api/app/config.py\n"
                    if case == "missing-intelligence": data["required_openapi_paths"] = ["/health"]
                    if case == "missing-core": data["required_openapi_paths"] = ["/api/intelligence/ask"]
                    if case == "wrong-mode": argv[-1] = "forward-only-migrations"
                    if case == "wrong-profile": data["runtime_profile"] = "preview"
                    if case == "new-pin": data["migrations"][0]["sha256"] = "0" * 64
                    if case == "missing-pin": data["migrations"].pop()
                    if case == "runner": changed = "scripts/apply_production_migrations.py\n"
                    if case == "sql": changed = migrations[0]["path"] + "\n"
                    path.write_text(json.dumps(data))
                    target = root / migrations[0]["path"]
                    saved = target.read_bytes()
                    if case == "checksum": target.write_bytes(b"tampered")
                    def git_result(command, **kwargs):
                        return json.dumps({"migrations": migrations, "required_openapi_paths": ["/health"]}).encode() if "show" in command else changed
                    try:
                        with mock.patch.object(sys, "argv", argv), mock.patch.object(subprocess, "check_output", side_effect=git_result):
                            if case == "valid": exec(compile(code, "descriptor-validator", "exec"), {})
                            else:
                                with self.assertRaises(SystemExit): exec(compile(code, "descriptor-validator", "exec"), {})
                    finally:
                        target.write_bytes(saved)
            self.assertEqual(len((root / "migrations.plan").read_text().splitlines()), 13)

    def test_record_stage_precedes_smoke_and_final_record_precedes_activation(self):
        for name in ["deploy_backend", "credential_cutover_backend"]:
            with self.subTest(operation=name):
                function = shell_function(name)
                self.assertLess(function.index("stage_backend_rollback_record"), function.index("start_candidate"))
                self.assertLess(function.index("docker create"), function.index("rollback_record finalize"))
                self.assertLess(function.index("rollback_record finalize"), function.index('start_backend_for_transition "$backend_live_container" target'))
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

    def test_unavailable_record_helper_cannot_execute_under_error_suppression(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            helper = Path(directory) / "missing-helper.py"
            harness = f'''set +e
rollback_record_helper='{helper.as_posix()}'
state_dir='{Path(directory).as_posix()}'
blocked() {{ return 1; }}
python3() {{ echo UNSAFE_EXECUTION; return 0; }}
'''
            result = self.bash(harness + shell_function("rollback_record") + '\nrollback_record restored || exit 7\necho UNSAFE_PASS\n')
            self.assertEqual(result.returncode, 7, result.stdout + result.stderr)
            self.assertNotIn("UNSAFE", result.stdout)

    def test_stopped_static_endpoint_is_released_and_restored_before_start(self):
        functions = "\n".join(shell_function(name) for name in ["network_ip_for_container", "network_attached_for_container", "network_static_ip_for_container", "assert_transition_ownership", "stop_backend_for_transition", "start_backend_for_transition", "disconnect_production_network", "ensure_production_network_ip"])
        harness = '''set -euo pipefail
production_network=harvest-net
deployment_id=test-only
operation=deploy
approved_production_ipv4=172.19.0.2
declare -A fixture_attached=([source]=true [target]=false)
declare -A fixture_runtime_ip=([source]='' [target]='')
declare -A fixture_static_ip=([source]=172.19.0.2 [target]='')
declare -A fixture_running=([source]=false [target]=false)
disconnects=0
connects=0
sleep() { :; }
rollback_record() {
  if [[ "$1" == transition-ready ]]; then
    [[ "$2" == test-only && "$3" == deploy && "$4" == "$5" && "${fixture_running[$5]}" == "$6" ]] || return 98
    local peer
    for peer in source target; do
      [[ "$peer" == "$5" || "${fixture_running[$peer]}" == false ]] || return 99
    done
    return 0
  fi
  [[ "$1" == network-state ]] || return 90
  case "$3" in
    attached) echo "${fixture_attached[$2]}";;
    ip) echo "${fixture_runtime_ip[$2]}";;
    static_ip) echo "${fixture_static_ip[$2]}";;
    running) echo "${fixture_running[$2]}";;
    *) return 90;;
  esac
}
docker() {
  local name template other
  case "$1 $2" in
    'inspect --format')
      template=$3; name=$4
      case "$template" in
        *'if index'*) echo "${fixture_attached[$name]}";;
        *IPAMConfig*) echo "${fixture_static_ip[$name]}";;
        *IPAddress*) echo "${fixture_runtime_ip[$name]}";;
        *State.Running*) echo "${fixture_running[$name]}";;
        *) return 91;;
      esac;;
    'network disconnect')
      [[ "$3" == --force && "$4" == harvest-net ]] || return 92
      name=$5
      fixture_attached[$name]=false; fixture_runtime_ip[$name]=''; fixture_static_ip[$name]=''
      disconnects=$((disconnects + 1));;
    'network connect')
      name=$6
      [[ "$3" == --ip && "$4" == 172.19.0.2 && "$5" == harvest-net ]] || return 93
      [[ "${fixture_attached[$name]}" == false ]] || return 94
      for other in source target; do
        [[ "$other" == "$name" || "${fixture_static_ip[$other]}" != 172.19.0.2 ]] || return 95
      done
      fixture_attached[$name]=true; fixture_static_ip[$name]=172.19.0.2
      # Docker reserves IPAM here; the runtime address appears only at start.
      connects=$((connects + 1));;
    'start source'|'start target')
      name=$2
      [[ "${fixture_attached[$name]}" == true && "${fixture_static_ip[$name]}" == 172.19.0.2 ]] || return 96
      fixture_running[$name]=true; fixture_runtime_ip[$name]=172.19.0.2;;
    'stop --time')
      [[ "$3" == 30 ]] || return 96
      name=$4; fixture_running[$name]=false; fixture_runtime_ip[$name]='';;
    *) return 97;;
  esac
}
'''
        actions = '''
ensure_production_network_ip source 172.19.0.2
[[ "$disconnects" == 0 && "$connects" == 0 ]]
disconnect_production_network source
[[ "${fixture_attached[source]}" == false && -z "${fixture_static_ip[source]}" ]]
ensure_production_network_ip target 172.19.0.2 target
[[ "${fixture_attached[target]}" == true && -z "${fixture_runtime_ip[target]}" ]]
ensure_production_network_ip target 172.19.0.2 target
[[ "$connects" == 1 ]]
start_backend_for_transition target target
# Simulate a failed target's health check and restore the original source.
stop_backend_for_transition target target
disconnect_production_network target target
ensure_production_network_ip source 172.19.0.2
start_backend_for_transition source source
[[ "${fixture_runtime_ip[source]}" == 172.19.0.2 && "${fixture_attached[target]}" == false ]]
[[ "$disconnects" == 2 && "$connects" == 2 ]]
echo STOPPED_ENDPOINT_ROLLBACK_AND_RESTORE=PASS
'''
        result = self.bash(harness + functions + actions)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("STOPPED_ENDPOINT_ROLLBACK_AND_RESTORE=PASS", result.stdout)

    def test_endpoint_inspection_and_disconnect_failure_cannot_be_masked(self):
        functions = "\n".join(shell_function(name) for name in ["disconnect_production_network", "ensure_production_network_ip"])
        for stubs, command in [
            ('network_attached_for_container() { echo true; return 7; }', 'disconnect_production_network source'),
            ('network_attached_for_container() { echo true; }; docker() { return 7; }', 'disconnect_production_network source'),
            ('network_attached_for_container() { echo true; }; docker() { return 0; }', 'disconnect_production_network source'),
            ('network_attached_for_container() { echo false; return 7; }', 'ensure_production_network_ip source 172.19.0.2'),
        ]:
            with self.subTest(stubs=stubs):
                result = self.bash('set +e\napproved_production_ipv4=172.19.0.2\nassert_transition_ownership() { return 0; }\n' + stubs + '\n' + functions + '\n' + command + ' || exit 7\necho UNSAFE_PASS\n')
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
select_candidate_mounts() {{ :; }}
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
assert_transition_ownership() {{ echo "ownership $*" >> "$trace"; }}
stop_backend_for_transition() {{ echo "stop $*" >> "$trace"; }}
start_backend_for_transition() {{ echo "start $*" >> "$trace"; }}
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
                    self.assertEqual(operations, "protected-check\n")
                else:
                    self.assertIn(f"docker rename {TARGET} harvest-api", operations)
                    self.assertLess(operations.index("protected-check"), operations.index("record receipt"))
                    self.assertNotRegex(operations, r"migrat|pg_dump|pg_restore")

    def test_stopped_source_failure_restores_prior_state_and_cannot_mask_contract_failure(self):
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
operation=rollback
original_network_ip=''
transaction_backup=''
state_dir='{folder}'
previous_state='{old.as_posix()}'
state_file='{active.as_posix()}'
approved_production_ipv4=172.19.0.2
container_exists() {{ return 0; }}
docker() {{ echo original-id; }}
container_running() {{ return 1; }}
ensure_production_network_ip() {{ return 0; }}
start_backend_for_transition() {{ [[ "$1" == harvest-api && "$2" == source ]]; }}
assert_live_contract() {{ [[ "$3" == true && "$4" == false ]] && {validation}; }}
rollback_record() {{ return 0; }}
'''
                result = self.bash(harness + shell_function("restore_original_backend") + '\nrestore_original_backend || true\necho "RESTORE=$automatic_restore_result"\n')
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(active.read_text(), "original-state\n")
                self.assertIn("RESTORE=" + ("pass" if validation == "true" else "failed"), result.stdout)

    def test_restore_preflight_rejections_cause_zero_service_mutation(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            trace = Path(directory) / "mutations"
            for failure in ("source-id", "restore-ready", "replacement-ready"):
                with self.subTest(failure=failure):
                    trace.write_text("")
                    harness = f'''set +e
backend_live_container=harvest-api
transaction_backup=harvest-api-pre-test
original_container_id=original-id
original_image_id=original-image
original_revision={CURRENT}
deployment_id={IDENTITY}
operation=deploy
container_exists() {{ return 0; }}
container_running() {{ return 1; }}
rollback_record() {{ [[ "$1" != '{failure}' ]]; }}
docker() {{
  if [[ "$1 $2" == 'inspect --format' ]]; then
    if [[ "$4" == "$transaction_backup" ]]; then
      echo {'wrong-id' if failure == 'source-id' else 'original-id'}
    else
      echo replacement-id
    fi
  else
    echo "$*" >> '{trace.as_posix()}'
  fi
}}
'''
                    result = self.bash(harness + shell_function("restore_original_backend") + '\nrestore_original_backend || exit 7\necho UNSAFE_PASS\n')
                    self.assertEqual(result.returncode, 7, result.stdout + result.stderr)
                    self.assertEqual(trace.read_text(), "")
                    self.assertNotIn("UNSAFE_PASS", result.stdout)

    def test_already_running_signed_original_restoration_is_noop(self):
        harness = f'''set -e
backend_live_container=harvest-api
transaction_backup=''
original_container_id=original-id
original_image_id=original-image
original_revision={CURRENT}
deployment_id={IDENTITY}
operation=deploy
container_exists() {{ return 0; }}
container_running() {{ return 0; }}
rollback_record() {{ [[ "$1" == restore-ready || "$1" == restored ]]; }}
assert_transition_ownership() {{ [[ "$1" == harvest-api && "$2" == source && "$3" == true ]]; }}
assert_live_contract() {{ return 0; }}
docker() {{ [[ "$1 $2" == 'inspect --format' ]] || return 91; echo original-id; }}
'''
        result = self.bash(harness + shell_function("restore_original_backend") + '\nrestore_original_backend\n[[ "$automatic_restore_result" == pass ]]\n')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_protected_snapshot_rejects_endpoint_mount_and_restart_drift(self):
        item, _ = artifacts(CURRENT, "1", running=True)
        item["Name"] = "/protected-preview"
        item["State"].update(Status="running", StartedAt="2026-09-01T00:00:00Z", Health={"Status": "healthy", "Log": [{"End": "volatile-probe-time"}]})
        item["NetworkSettings"]["Networks"]["harvest-net"].update(Aliases=["protected-alias", "second-alias"], IPAMConfig={"IPv4Address": "172.19.0.9"})
        item["Config"]["Env"].append("SENTINEL_SECRET=must-never-appear")
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
            fixture = Path(directory) / "inspect.json"
            harness = f'''set -euo pipefail
backend_live_container=harvest-api
docker() {{ if [[ "$1" == ps ]]; then echo protected-id; else cat '{fixture.as_posix()}'; fi; }}
python3() {{ command '{Path(os.sys.executable).as_posix()}' "$@"; }}
'''
            def snapshot(value):
                fixture.write_text(json.dumps([value]))
                result = self.bash(harness + shell_function("snapshot_unrelated_containers") + "\nsnapshot_unrelated_containers\n")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertNotIn("SENTINEL_SECRET", result.stdout)
                self.assertNotIn("volatile-probe-time", result.stdout)
                return result.stdout
            baseline = snapshot(item)
            changes = [
                lambda value: value["NetworkSettings"]["Networks"]["harvest-net"].update(Aliases=["changed-alias"]),
                lambda value: value["NetworkSettings"]["Networks"]["harvest-net"].update(IPAddress="172.19.0.99"),
                lambda value: value["NetworkSettings"]["Networks"]["harvest-net"]["IPAMConfig"].update(IPv4Address="172.19.0.99"),
                lambda value: value["NetworkSettings"]["Networks"].update(extra={"IPAddress": "10.0.0.9"}),
                lambda value: value["Mounts"][0].update(RW=False),
                lambda value: value.update(RestartCount=1),
                lambda value: value["HostConfig"]["RestartPolicy"].update(Name="no"),
                lambda value: value["HostConfig"].update(Memory=1048576),
                lambda value: value["HostConfig"].update(NanoCpus=1000000000),
                lambda value: value["State"].update(StartedAt="2026-09-09T00:00:00Z"),
                lambda value: value["State"].update(Status="restarting"),
                lambda value: value["State"]["Health"].update(Status="unhealthy"),
            ]
            for change in changes:
                modified = copy.deepcopy(item)
                change(modified)
                self.assertNotEqual(snapshot(modified), baseline)
            equivalent = dict(reversed(list(item.items())))
            equivalent["Mounts"] = list(reversed(item["Mounts"]))
            equivalent["NetworkSettings"] = {"Networks": {"harvest-net": dict(reversed(list(item["NetworkSettings"]["Networks"]["harvest-net"].items())))}}
            equivalent["NetworkSettings"]["Networks"]["harvest-net"]["Aliases"] = list(reversed(item["NetworkSettings"]["Networks"]["harvest-net"]["Aliases"]))
            equivalent["State"] = copy.deepcopy(item["State"])
            equivalent["State"]["Health"]["Log"] = [{"End": "later-probe-time"}]
            self.assertEqual(snapshot(equivalent), baseline)

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

    def test_nested_guards_propagate_command_failure_and_early_mismatch(self):
        prefix = '''set +e
blocked() { return 1; }
database_name=mfms_server_prod
production_network=harvest-net
approved_production_subnet=172.19.0.0/16
approved_production_gateway=172.19.0.1
approved_production_dynamic_pool=172.19.128.0/17
expected_mount_contract=approved
'''
        cases = [
            ("assert_database_target", 'database_for_container() { echo wrong-db; }; docker() { echo mfms_server_prod; }'),
            ("assert_database_target", 'database_for_container() { echo mfms_server_prod; return 7; }; docker() { echo mfms_server_prod; }'),
            ("assert_database_target", 'database_for_container() { echo mfms_server_prod; }; docker() { echo mfms_server_prod; return 7; }'),
            ("assert_approved_mount_contract", 'mount_contract_for_container() { echo approved; return 7; }'),
            ("assert_production_ipam_contract", 'docker() { case "$*" in *Subnet*) echo wrong-subnet;; *Gateway*) echo 172.19.0.1;; *IPRange*) echo 172.19.128.0/17;; esac; }'),
            ("assert_production_ipam_contract", 'docker() { case "$*" in *Subnet*) echo 172.19.0.0/16;; *Gateway*) echo wrong-gateway;; *IPRange*) echo 172.19.128.0/17;; esac; }'),
            ("assert_production_ipam_contract", 'docker() { case "$*" in *Subnet*) echo 172.19.0.0/16;; *Gateway*) echo 172.19.0.1;; *IPRange*) echo 172.19.128.0/17;; esac; return 7; }'),
        ]
        for function, stubs in cases:
            with self.subTest(function=function, stubs=stubs):
                result = self.bash(prefix + stubs + "\n" + shell_function(function) + f"\n{function} harvest-api || exit 7\necho UNSAFE_PASS\n")
                self.assertEqual(result.returncode, 7, result.stdout + result.stderr)
                self.assertNotIn("UNSAFE_PASS", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
