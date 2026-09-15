"""Hermetic tests for the fail-closed Production auth session comparator."""

from __future__ import annotations

import copy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / "scripts" / "production-auth-session-guard.py"
T0 = 2_000_000_000_000
IDLE = 12 * 60 * 60 * 1000


def session(username: str, created: int, last_seen: int, expires: int, suffix: str) -> dict:
    return {
        "canonicalUsername": username,
        "csrfToken": f"csrf-secret-{suffix}",
        "createdAt": created,
        "lastSeenAt": last_seen,
        "expiresAt": expires,
        "ip": "192.0.2.10",
        "userAgent": "fixture-agent",
    }


class SessionGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.state = self.root / "state"
        self.state.mkdir()
        os.chmod(self.state, 0o700)
        self.sessions = self.root / "sessions.json"
        self.users = self.root / "users.json"
        self.audit = self.root / "audit.jsonl"
        self.records = {
            "opaque-token-digest-active-harsha": session("harsha", T0 - 100_000, T0 - 10_000, T0 + 900_000, "harsha"),
            "opaque-token-digest-active-vijay": session("vijay", T0 - 200_000, T0 - 20_000, T0 + 800_000, "vijay"),
            "opaque-token-digest-expired-absolute": session("old-one", T0 - 500_000, T0 - 400_000, T0 - 1, "expired-absolute"),
            "opaque-token-digest-expired-idle": session("harsha", T0 - IDLE - 100_000, T0 - IDLE - 1, T0 + 700_000, "expired-idle"),
        }
        self.write_sessions(self.records)
        self.write(
            self.users,
            b'{"version":1,"users":{"harsha":{"role":"Viewer","environmentAccess":["Production"]}}}\n',
        )
        self.write(self.audit, b"")
        self.snapshot()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    @staticmethod
    def write(path: Path, data: bytes) -> None:
        path.write_bytes(data)
        os.chmod(path, 0o600)

    def write_sessions(self, records: dict, *, pretty: bool = False, reverse: bool = False) -> None:
        items = list(records.items())
        if reverse:
            items.reverse()
        document = {"version": 1, "sessions": dict(items)}
        data = json.dumps(document, indent=2 if pretty else None).encode() + b"\n"
        self.write(self.sessions, data)

    def run_guard(self, operation: str, *extra: str) -> subprocess.CompletedProcess[str]:
        command = [sys.executable, str(GUARD), operation, "--sessions", str(self.sessions), "--state", str(self.state)]
        if operation in {"snapshot", "compare"}:
            command += ["--users", str(self.users), "--audit", str(self.audit)]
        command += list(extra)
        return subprocess.run(command, text=True, capture_output=True, check=False)

    def snapshot(self) -> None:
        result = self.run_guard(
            "snapshot",
            "--cutoff-ms",
            str(T0),
            "--idle-ms",
            str(IDLE),
            "--require-active-user",
            "harsha",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("SESSION_GUARD_SNAPSHOT=PASS", result.stdout)

    def compare(self, expected: int = 0) -> subprocess.CompletedProcess[str]:
        result = self.run_guard("compare", "--observed-ms", str(T0 + 60_000))
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def test_exact_removal_of_sessions_expired_at_t0_passes(self) -> None:
        current = {key: value for key, value in self.records.items() if "expired" not in key}
        self.write_sessions(current)
        result = self.compare()
        self.assertIn("removed_expired_at_t0=2", result.stdout)

    def test_required_active_harsha_session_is_enforced_at_t0(self) -> None:
        self.state = self.root / "missing-required-user-state"
        self.state.mkdir()
        os.chmod(self.state, 0o700)
        current = {
            key: value
            for key, value in self.records.items()
            if value["canonicalUsername"] != "harsha"
        }
        self.write_sessions(current)
        result = self.run_guard(
            "snapshot",
            "--cutoff-ms",
            str(T0),
            "--idle-ms",
            str(IDLE),
            "--require-active-user",
            "harsha",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("required active Production session", result.stderr)

    def test_removal_of_active_session_fails(self) -> None:
        current = copy.deepcopy(self.records)
        del current["opaque-token-digest-active-harsha"]
        self.write_sessions(current)
        self.assertIn("active at T0 was removed", self.compare(1).stderr)

    def test_removal_of_session_expiring_after_t0_fails(self) -> None:
        current = copy.deepcopy(self.records)
        del current["opaque-token-digest-active-vijay"]
        self.write_sessions(current)
        self.assertIn("active at T0 was removed", self.compare(1).stderr)

    def test_every_protected_active_field_mutation_fails_without_secret_output(self) -> None:
        mutations = {
            "canonicalUsername": "attacker",
            "csrfToken": "replacement-csrf-secret",
            "createdAt": T0 - 99_999,
            "expiresAt": T0 + 1_000_000,
            "ip": "198.51.100.12",
            "userAgent": "replacement-agent",
        }
        for field, value in mutations.items():
            with self.subTest(field=field):
                self.tearDown()
                self.setUp()
                current = copy.deepcopy(self.records)
                current["opaque-token-digest-active-harsha"][field] = value
                self.write_sessions(current)
                result = self.compare(1)
                combined = result.stdout + result.stderr
                self.assertIn("protected session data changed", combined)
                self.assertNotIn("opaque-token", combined)
                self.assertNotIn("csrf-secret", combined)

    def test_session_identifier_replacement_fails(self) -> None:
        current = copy.deepcopy(self.records)
        record = current.pop("opaque-token-digest-active-harsha")
        current["opaque-token-digest-active-harsha-replacement"] = record
        self.write_sessions(current)
        self.assertIn("new session appeared", self.compare(1).stderr)

    def test_new_session_insertion_fails(self) -> None:
        current = copy.deepcopy(self.records)
        current["opaque-token-digest-new"] = session("new-user", T0, T0, T0 + 600_000, "new")
        self.write_sessions(current)
        self.assertIn("new session appeared", self.compare(1).stderr)

    def test_last_seen_reduction_fails(self) -> None:
        current = copy.deepcopy(self.records)
        current["opaque-token-digest-active-harsha"]["lastSeenAt"] -= 1
        self.write_sessions(current)
        self.assertIn("moved backward", self.compare(1).stderr)

    def test_unexplained_last_seen_advancement_fails(self) -> None:
        current = copy.deepcopy(self.records)
        current["opaque-token-digest-active-harsha"]["lastSeenAt"] = T0 + 10_000
        self.write_sessions(current)
        self.assertIn("without unambiguous audit evidence", self.compare(1).stderr)

    def test_properly_audited_monotonic_last_seen_advancement_passes(self) -> None:
        current = copy.deepcopy(self.records)
        current["opaque-token-digest-active-harsha"]["lastSeenAt"] = T0 + 10_000
        self.write_sessions(current)
        timestamp = datetime.fromtimestamp((T0 + 11_000) / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
        self.write(self.audit, json.dumps({
            "timestamp": timestamp,
            "event": "login_existing_session_redirect",
            "actor": "harsha",
        }, separators=(",", ":")).encode() + b"\n")
        result = self.compare()
        self.assertIn("audited_touches=1", result.stdout)

    def test_one_audit_event_cannot_revive_or_change_an_expired_session(self) -> None:
        current = copy.deepcopy(self.records)
        current["opaque-token-digest-active-harsha"]["lastSeenAt"] = T0 + 10_000
        expired = current["opaque-token-digest-expired-idle"]
        expired["lastSeenAt"] = T0 - IDLE + 10_000
        self.write_sessions(current)
        timestamp = datetime.fromtimestamp((T0 + 11_000) / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
        self.write(self.audit, json.dumps({
            "timestamp": timestamp,
            "event": "login_existing_session_redirect",
            "actor": "harsha",
        }, separators=(",", ":")).encode() + b"\n")
        self.assertIn("expired at T0 changed", self.compare(1).stderr)

    def test_json_format_property_and_record_order_only_changes_pass(self) -> None:
        reordered = {}
        for key, record in reversed(list(self.records.items())):
            reordered[key] = dict(reversed(list(record.items())))
        self.write_sessions(reordered, pretty=True)
        self.compare()

    def test_malformed_and_empty_session_data_fail(self) -> None:
        for data in (b"", b"not-json", b'{"version":1,"sessions":{}}'):
            with self.subTest(data=data):
                self.write(self.sessions, data)
                result = self.compare(1)
                self.assertRegex(result.stderr, r"empty|malformed|inventory is empty")

    def test_user_store_mutation_fails(self) -> None:
        original = self.users.read_bytes()
        for old, new in ((b'"Viewer"', b'"Admin"'), (b'"Production"', b'"Preview"')):
            with self.subTest(field=old):
                self.write(self.users, original.replace(old, new))
                self.assertIn("user store changed", self.compare(1).stderr)

    def test_audit_truncation_rewrite_and_unexpected_append_fail(self) -> None:
        self.tearDown()
        self.setUp()
        # Create a non-empty baseline in a fresh fixture.
        self.temporary.cleanup()
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.state = self.root / "state"
        self.state.mkdir()
        os.chmod(self.state, 0o700)
        self.sessions = self.root / "sessions.json"
        self.users = self.root / "users.json"
        self.audit = self.root / "audit.jsonl"
        self.records = {
            "opaque-token-digest-active-harsha": session("harsha", T0 - 100_000, T0 - 10_000, T0 + 900_000, "harsha"),
        }
        self.write_sessions(self.records)
        self.write(self.users, b'{"version":1,"users":{}}\n')
        baseline = b'{"timestamp":"2033-05-18T03:33:19Z","event":"baseline"}\n'
        self.write(self.audit, baseline)
        self.snapshot()
        self.write(self.audit, b"")
        self.assertIn("truncated or rewritten", self.compare(1).stderr)
        self.write(self.audit, baseline.replace(b'"baseline"', b'"tampered"'))
        self.assertIn("truncated or rewritten", self.compare(1).stderr)
        self.write(self.audit, baseline + b'{"timestamp":"2033-05-18T03:33:21Z","event":"server_error"}\n')
        self.assertIn("unexpected activity", self.compare(1).stderr)

    def test_exact_byte_backup_restoration_passes(self) -> None:
        original = self.sessions.read_bytes()
        current = {key: value for key, value in self.records.items() if "expired" not in key}
        self.write_sessions(current)
        result = self.run_guard("restore")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.sessions.read_bytes(), original)
        self.assertIn("SESSION_GUARD_RESTORE=PASS", result.stdout)


if __name__ == "__main__":
    unittest.main()
