"""Pure evidence contract tests; no Docker or live resources are accessed."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location("evidence", Path(__file__).with_name("docker_inspect_evidence.py"))
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def fixture():
    return {"Id": "a" * 64, "Name": "/protected", "Image": "sha256:" + "b" * 64,
            "RestartCount": 0, "Path": "python", "Args": ["-m", "app"],
            "Config": {"Env": ["TOKEN=private", "MFMS_ENV=production"], "Cmd": ["a", "b"],
                       "Entrypoint": ["python", "-m"], "Labels": {"environment": "Production"}},
            "HostConfig": {"NetworkMode": "private-network", "Privileged": False,
                           "PortBindings": {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8001"}]},
                           "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0},
                           "Binds": ["/a:/a:ro", "/b:/b:rw"]},
            "Mounts": [{"Type": "bind", "Source": "/a", "Destination": "/a", "RW": False, "Propagation": "rprivate"},
                       {"Type": "bind", "Source": "/b", "Destination": "/b", "RW": True, "Propagation": "rprivate"}],
            "NetworkSettings": {"Networks": {"private-network": {
                "NetworkID": "n" * 64, "IPAddress": "172.30.240.2", "IPAMConfig": {"IPv4Address": "172.30.240.2"},
                "Aliases": ["one", "two"], "DNSNames": ["one", "two"]}}},
            "State": {"Running": True, "Status": "running", "StartedAt": "start", "Restarting": False,
                      "Paused": False, "Dead": False, "Health": {"Status": "healthy", "FailingStreak": 0,
                                                                  "Log": [{"Start": "old", "Output": "ok"}]}}}


class CanonicalizerTests(unittest.TestCase):
    def changed(self, mutate):
        before = fixture()
        after = copy.deepcopy(before)
        mutate(after)
        self.assertNotEqual(M.sha(M.stable(before)), M.sha(M.stable(after)))
        self.assertTrue(M.differences(M.stable(before), M.stable(after)))

    def test_mount_and_alias_order_only(self):
        before = fixture()
        after = copy.deepcopy(before)
        after["Mounts"].reverse()
        for key in ("Aliases", "DNSNames"):
            after["NetworkSettings"]["Networks"]["private-network"][key].reverse()
        self.assertNotEqual(M.sha(before), M.sha(after))
        self.assertEqual(M.sha(M.stable(before)), M.sha(M.stable(after)))
        self.assertEqual(before, fixture(), "Canonicalization must not mutate original evidence")

    def test_network_ipam_subnet_order_and_complete_records_protected(self):
        before = {"IPAM": {"Config": [{"Subnet": "172.30.240.0/24", "AuxiliaryAddresses": {"a": "172.30.240.3"}},
                                       {"Subnet": "172.31.0.0/24"}]}}
        after = copy.deepcopy(before)
        after["IPAM"]["Config"].reverse()
        self.assertNotEqual(M.canonicalize(before), M.canonicalize(after))
        after["IPAM"]["Config"][1]["AuxiliaryAddresses"]["a"] = "172.30.240.4"
        self.assertNotEqual(M.canonicalize(before), M.canonicalize(after))

    def test_top_level_exec_ids_permutation_preserves_raw_and_duplicates(self):
        before = fixture()
        before["ExecIDs"] = ["id-b", "id-a", "id-b", "id-c"]
        raw_before = copy.deepcopy(before)
        after = copy.deepcopy(before)
        after["ExecIDs"] = ["id-c", "id-b", "id-a", "id-b"]
        self.assertNotEqual(M.sha(before), M.sha(after))
        self.assertEqual(M.sha(M.stable(before)), M.sha(M.stable(after)))
        self.assertEqual(M.canonicalize(before)["ExecIDs"], ["id-a", "id-b", "id-b", "id-c"])
        self.assertEqual(before, raw_before)

    def test_exec_ids_add_remove_change_duplicate_and_type_drift_reject(self):
        before = fixture()
        before["ExecIDs"] = ["id-a", "id-b", "id-b"]
        for value in (["id-a", "id-b"], ["id-a", "id-b", "id-b", "id-b"], ["id-a", "id-b", "id-c"],
                      [], None, "id-a", {}, ["id-a", "id-b", 0], ["id-a", "id-b", False]):
            with self.subTest(value=value):
                after = copy.deepcopy(before)
                after["ExecIDs"] = value
                self.assertNotEqual(M.sha(M.stable(before)), M.sha(M.stable(after)))
        distinct = [{}, {"ExecIDs": None}, {"ExecIDs": []}, {"ExecIDs": ""}, {"ExecIDs": {}}]
        self.assertEqual(len({M.sha(M.canonicalize(item)) for item in distinct}), len(distinct))

    def test_exec_ids_normalization_is_top_level_string_lists_only(self):
        for left, right in (
            ({"Config": {"ExecIDs": ["b", "a"]}}, {"Config": {"ExecIDs": ["a", "b"]}}),
            ({"ExecIDs": ["b", 1]}, {"ExecIDs": [1, "b"]}),
            ({"Args": ["b", "a"]}, {"Args": ["a", "b"]}),
            ({"Config": {"Cmd": ["b", "a"]}}, {"Config": {"Cmd": ["a", "b"]}}),
        ):
            with self.subTest(left=left):
                self.assertNotEqual(M.sha(M.canonicalize(left)), M.sha(M.canonicalize(right)))
    def test_all_mount_fields_protected(self):
        for key, value in {"Type": "volume", "Source": "/elsewhere", "Destination": "/other", "RW": True,
                           "Propagation": "shared", "Mode": "rw", "FutureOption": {"allow": True}}.items():
            with self.subTest(key=key):
                self.changed(lambda item: item["Mounts"][0].__setitem__(key, value))

    def test_mount_add_remove_and_duplicate_multiplicity(self):
        for operation in (lambda mounts: mounts.pop(), lambda mounts: mounts.append(copy.deepcopy(mounts[0])),
                          lambda mounts: mounts.__setitem__(1, copy.deepcopy(mounts[0]))):
            with self.subTest(operation=operation):
                self.changed(lambda item: operation(item["Mounts"]))

    def test_ordered_command_entrypoint_environment_and_binds(self):
        for group, key in (("Config", "Cmd"), ("Config", "Entrypoint"), ("Config", "Env"), ("HostConfig", "Binds")):
            with self.subTest(key=key):
                self.changed(lambda item: item[group][key].reverse())

    def test_environment_and_privileges(self):
        self.changed(lambda item: item["Config"]["Env"].__setitem__(0, "TOKEN=different"))
        self.changed(lambda item: item["HostConfig"].__setitem__("Privileged", True))
        self.changed(lambda item: item["Config"]["Labels"].__setitem__("environment", "Preview"))

    def test_image_name_id_restart_and_runtime_state(self):
        for key, value in {"Image": "sha256:" + "c" * 64, "Name": "/renamed", "Id": "d" * 64,
                           "RestartCount": 1, "Path": "sh", "Args": ["app", "-m"]}.items():
            with self.subTest(key=key):
                self.changed(lambda item: item.__setitem__(key, value))
        for key, value in {"Running": False, "Status": "exited", "StartedAt": "later", "Restarting": True,
                           "Paused": True, "Dead": True, "FutureFlag": True}.items():
            with self.subTest(key=key):
                self.changed(lambda item: item["State"].__setitem__(key, value))

    def test_ports_restart_policy_and_network_mode(self):
        for key, value in {"HostIp": "0.0.0.0", "HostPort": "8002", "FuturePortFlag": True}.items():
            with self.subTest(key=key):
                self.changed(lambda item: item["HostConfig"]["PortBindings"]["8000/tcp"][0].__setitem__(key, value))
        self.changed(lambda item: item["HostConfig"]["RestartPolicy"].__setitem__("Name", "always"))
        self.changed(lambda item: item["HostConfig"].__setitem__("NetworkMode", "host"))

    def test_network_fields_alias_add_remove_duplicate_and_unknown(self):
        for key, value in {"IPAddress": "172.30.240.3", "NetworkID": "other", "IPAMConfig": {"IPv4Address": "172.30.240.4"},
                           "Aliases": ["one"], "DNSNames": ["one", "two", "two"], "FutureOption": [1, 2]}.items():
            with self.subTest(key=key):
                self.changed(lambda item: item["NetworkSettings"]["Networks"]["private-network"].__setitem__(key, value))
        self.changed(lambda item: item["NetworkSettings"]["Networks"].__setitem__("extra", {}))

    def test_unknown_fields_types_and_lists_are_not_discarded(self):
        self.changed(lambda item: item.__setitem__("FutureField", {"nested": [1, 2]}))
        self.changed(lambda item: item["Mounts"][0].__setitem__("RW", 0))
        before = {"unknown": [1, 2]}
        self.assertNotEqual(M.canonicalize(before), M.canonicalize({"unknown": [2, 1]}))
        self.assertTrue(M.differences({"boolean": False}, {"boolean": 0}))

    def test_inventory_add_and_remove(self):
        before = {"a": M.stable(fixture())}
        self.assertTrue(M.differences(before, {}))
        self.assertTrue(M.differences(before, {**before, "b": M.stable(fixture())}))

    def test_only_health_sample_log_is_volatile(self):
        before = fixture()
        after = copy.deepcopy(before)
        after["State"]["Health"]["Log"] = [{"Start": "new", "Output": "ok"}]
        self.assertTrue(M.differences(before, after))
        self.assertEqual(M.stable(before), M.stable(after))
        self.changed(lambda item: item["State"]["Health"].__setitem__("Status", "unhealthy"))
        self.changed(lambda item: item["State"]["Health"].__setitem__("FailingStreak", 1))

    def test_private_diff_is_written_before_returning_failure(self):
        evidence = object.__new__(M.Evidence)
        evidence.write = mock.Mock()
        before = {"a": fixture()}
        after = copy.deepcopy(before)
        after["a"]["Config"]["Env"][0] = "TOKEN=changed"
        result = evidence.comparison(before, after)
        self.assertGreater(result["protected_changes"], 0)
        self.assertEqual([call.args[0] for call in evidence.write.call_args_list], ["comparison.json", "comparison.summary.json"])
        self.assertNotIn("TOKEN", json.dumps(result))
        self.assertNotIn("private", json.dumps(result))

    def test_raw_inspect_is_saved_before_parse_failure(self):
        evidence = object.__new__(M.Evidence)
        evidence.sequence = 0
        evidence.previous = {}
        evidence.write = mock.Mock()
        evidence.inspection("not-json\n")
        self.assertEqual(evidence.write.call_args_list[0], mock.call("inspect-0001.raw.json", b"not-json\n", raw=True))
        self.assertEqual(evidence.write.call_args_list[1].args[1]["parse_status"], "invalid-json")

    def test_exception_details_are_retained_privately_without_printing(self):
        evidence = object.__new__(M.Evidence)
        evidence.sequence = 7
        evidence.write = mock.Mock()
        with mock.patch("builtins.print") as output:
            try:
                raise RuntimeError("private-test-sentinel")
            except RuntimeError as error:
                evidence.failure("primary-failure", error)
        output.assert_not_called()
        filename, details = evidence.write.call_args.args
        self.assertEqual(filename, "primary-failure.json")
        self.assertEqual(details["exception_type"], "RuntimeError")
        self.assertIn("private-test-sentinel", details["traceback"])
        self.assertEqual(details["last_inspect_sequence"], 7)


if __name__ == "__main__":
    unittest.main()
