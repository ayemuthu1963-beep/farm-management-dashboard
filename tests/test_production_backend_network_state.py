"""Raw JSON endpoint regression gates; no Docker mutations or live data."""
import copy
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("network_record", Path(__file__).resolve().parents[1] / "scripts/production-backend-rollback-record.py")
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def fixture():
    network = {"Name": "harvest-net", "Driver": "bridge", "Id": "a" * 64,
               "IPAM": {"Config": [{"Subnet": "172.19.0.0/16", "IPRange": "172.19.128.0/17", "Gateway": "172.19.0.1"}]},
               "Containers": {}}
    item = {"Id": "b" * 64, "State": {"Running": False, "Paused": False, "Restarting": False, "Dead": False}, "NetworkSettings": {"Networks": {"harvest-net": {
        "NetworkID": "", "EndpointID": "", "IPAddress": "", "IPAMConfig": {"IPv4Address": "172.19.0.2", "IPv6Address": ""}}}}}
    return item, network


class NetworkTests(unittest.TestCase):
    def active_peer(self, network, identity="c" * 64):
        peer, _ = fixture()
        peer["Id"] = identity
        peer["State"]["Running"] = True
        peer["NetworkSettings"]["Networks"]["harvest-net"].update(
            NetworkID=network["Id"], EndpointID="d" * 64, IPAddress="172.19.0.2")
        network["Containers"][identity] = {"IPv4Address": "172.19.0.2/16", "EndpointID": "d" * 64}
        return peer

    def test_single_active_peer_requires_injected_lifecycle_and_relaxed_phase(self):
        item, network = fixture()
        peer = self.active_peer(network)
        with self.assertRaises(M.Refused):
            M.network_state(item, network, check_conflicts=False)
        with self.assertRaises(M.Refused):
            M.network_state(item, network, owner_items={peer["Id"]: peer})
        result = M.network_state(item, network, check_conflicts=False, owner_items={peer["Id"]: peer})
        self.assertFalse(result["running"])
        self.assertTrue(result["attached"])

    def test_duplicate_active_owners_always_reject_even_when_both_are_proven(self):
        item, network = fixture()
        first = self.active_peer(network)
        second = self.active_peer(network, "e" * 64)
        for conflicts in (True, False):
            with self.subTest(check_conflicts=conflicts), self.assertRaises(M.Refused):
                M.network_state(item, network, check_conflicts=conflicts,
                                owner_items={first["Id"]: first, second["Id"]: second})

    def test_active_peer_lifecycle_and_endpoint_cannot_be_forged(self):
        item, network = fixture()
        peer = self.active_peer(network)
        mutations = [("State", key, value) for key in ("Running", "Paused", "Restarting", "Dead")
                     for value in (None, 0, 1, "false", [], {})]
        mutations += [("State", "Running", False), ("State", "Paused", True),
                      ("State", "Restarting", True), ("State", "Dead", True)]
        mutations += [("endpoint", key, value) for key, value in
                      (("NetworkID", "f" * 64), ("EndpointID", "f" * 64),
                       ("IPAddress", "172.19.0.3"), ("IPAMConfig", {}))]
        for section, key, value in mutations:
            changed = copy.deepcopy(peer)
            target = changed["State"] if section == "State" else changed["NetworkSettings"]["Networks"]["harvest-net"]
            target[key] = value
            with self.subTest(section=section, key=key, value=value), self.assertRaises(M.Refused):
                M.network_state(item, network, check_conflicts=False, owner_items={peer["Id"]: changed})

    def test_lifecycle_flags_require_explicit_false_booleans(self):
        for key in ("Paused", "Restarting", "Dead"):
            for value in (True, None, "false", "true", "", 0, 1, [], {}, [False], {"value": False}):
                with self.subTest(key=key, value=value):
                    item, network = fixture()
                    item["State"][key] = value
                    with self.assertRaises(M.Refused):
                        M.network_state(item, network)
            with self.subTest(key=key, missing=True):
                item, network = fixture()
                del item["State"][key]
                with self.assertRaises(M.Refused):
                    M.network_state(item, network)

    def test_retained_empty_json_is_valid_without_formatter(self):
        item, network = fixture()
        self.assertEqual(M.network_state(item, network), {"attached": True, "running": False, "ip": "", "static_ip": "172.19.0.2"})

    def test_verified_missing_stopped_attachment_is_distinct(self):
        item, network = fixture()
        item["NetworkSettings"]["Networks"] = {}
        self.assertEqual(M.network_state(item, network)["attached"], False)
        item["State"]["Running"] = True
        with self.assertRaises(M.Refused):
            M.network_state(item, network)

    def test_running_requires_exact_runtime_and_network_identity(self):
        item, network = fixture()
        item["State"]["Running"] = True
        with self.assertRaises(M.Refused):
            M.network_state(item, network)
        item["NetworkSettings"]["Networks"]["harvest-net"].update(NetworkID=network["Id"], EndpointID="c" * 64, IPAddress="172.19.0.2")
        with self.assertRaises(M.Refused):
            M.network_state(item, network)
        network["Containers"][item["Id"]] = {"IPv4Address": "172.19.0.2/16", "EndpointID": "c" * 64}
        self.assertTrue(M.network_state(item, network)["running"])

    def test_malformed_out_of_subnet_and_unverified_static_reject(self):
        original, network = fixture()
        for key, value in (("IPAddress", "invalid IP"), ("IPAddress", None), ("IPAddress", False),
                           ("IPAddress", "172.20.0.2"), ("IPAddress", "172.19.0.3"),
                           ("IPAMConfig", None), ("IPAMConfig", {}), ("IPAMConfig", {"IPv4Address": "172.20.0.2"}),
                           ("EndpointID", None), ("NetworkID", "wrong")):
            with self.subTest(key=key, value=value):
                item = copy.deepcopy(original)
                item["NetworkSettings"]["Networks"]["harvest-net"][key] = value
                with self.assertRaises(M.Refused):
                    M.network_state(item, network)

    def test_active_duplicate_and_wrong_network_reject(self):
        item, network = fixture()
        network["Containers"]["c" * 64] = {"IPv4Address": "172.19.0.2/16"}
        with self.assertRaises(M.Refused):
            M.network_state(item, network)
        network["Containers"] = {}
        network["IPAM"]["Config"][0]["Subnet"] = "172.20.0.0/16"
        with self.assertRaises(M.Refused):
            M.network_state(item, network)

    def test_malformed_missing_fields_and_preview_network_reject(self):
        item, network = fixture()
        del item["NetworkSettings"]["Networks"]["harvest-net"]["IPAddress"]
        with self.assertRaises(M.Refused):
            M.network_state(item, network)
        item, network = fixture()
        item["State"]["Running"] = 0
        with self.assertRaises(M.Refused):
            M.network_state(item, network)
        item, network = fixture()
        network["Name"] = "harvest-preview-net"
        with self.assertRaises(M.Refused):
            M.network_state(item, network)


if __name__ == "__main__":
    unittest.main()
