"""Executable security gates and rollback fault tests; no Docker/server access."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "scripts/preview-coconut-one-time-hotfix.py"
spec = importlib.util.spec_from_file_location("hotfix", MODULE)
hotfix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hotfix)


def live_fixture():
    env = ["MFMS_GIT_COMMIT=" + hotfix.BASE, "MFMS_ENV=preview", "MFMS_BUILD_ENVIRONMENT=Preview",
           "MFMS_TARGET_DATABASE=mfms_server_uat", "DATABASE_URL=postgresql://mfms_uat_app:synthetic@harvest-db:5432/mfms_server_uat"]
    return {"Id": "original", "Name": "/harvest-api-pilot", "State": {"Running": True}, "Image": hotfix.BASE_IMAGE,
            "Config": {"Env": env, "Labels": {"org.opencontainers.image.revision": hotfix.BASE, "com.muthufarms.mfms.environment": "Preview"}},
            "HostConfig": {"NetworkMode": hotfix.NETWORK, "PortBindings": {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8015"}]},
                           "RestartPolicy": {"Name": "no", "MaximumRetryCount": 0}, "Privileged": False, "PidMode": "", "IpcMode": "private",
                           "Binds": None, "Mounts": [{"Source": source, "Target": target, "Type": "bind", "ReadOnly": not rw} for target, (source, rw) in hotfix.MOUNTS.items()]},
            "NetworkSettings": {"Networks": {hotfix.NETWORK: {"NetworkID": hotfix.NETWORK_ID, "IPAddress": hotfix.IP}}},
            "Mounts": [{"Destination": target, "Source": source, "RW": rw, "Type": "bind"} for target, (source, rw) in hotfix.MOUNTS.items()]}


class LiveGates(unittest.TestCase):
    def setUp(self):
        self.live = live_fixture()
        self.env_patch = patch.object(hotfix, "BASE_ENV_HASH", hotfix.digest(hotfix.canonical(self.live["Config"]["Env"])))
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def test_pinned_live_accepts(self):
        hotfix.validate_live(self.live)

    def test_wrong_image_rejected(self):
        self.live["Image"] = "sha256:" + "1" * 64
        with self.assertRaisesRegex(hotfix.Blocked, "image mismatch"):
            hotfix.validate_live(self.live)

    def test_replay_after_success_rejected(self):
        self.live["Config"]["Env"][0] = "MFMS_GIT_COMMIT=" + hotfix.CANDIDATE
        with self.assertRaisesRegex(hotfix.Blocked, "replay"):
            hotfix.validate_live(self.live)

    def test_production_environment_container_network_rejected(self):
        for mutation in (lambda d: d.update(Name="/harvest-api"),
                         lambda d: d["Config"]["Env"].__setitem__(1, "MFMS_ENV=production"),
                         lambda d: d["HostConfig"].update(NetworkMode="production")):
            with self.subTest(mutation=mutation):
                candidate = copy.deepcopy(self.live)
                mutation(candidate)
                with self.assertRaises(hotfix.Blocked):
                    hotfix.validate_live(candidate)

    def test_production_and_alternate_database_targets_rejected(self):
        for url in ("postgresql://mfms_uat_app:x@production/mfms_server_uat",
                    "postgresql://mfms_uat_app:x@harvest-db/mfms_server",
                    "postgresql://mfms_uat_app:x@harvest-db/mfms_server_uat?hostaddr=10.0.0.1",
                    "postgresql://postgres:x@harvest-db/mfms_server_uat",
                    "postgresql://mfms_uat_app:x@harvest-db:5433/mfms_server_uat"):
            with self.subTest(url=url), self.assertRaises(hotfix.Blocked):
                hotfix.validate_database_url(url)

    def test_ledger_hash_count_full_rows_and_records_rejected(self):
        good = {"identity": {"db": hotfix.DB, "role": "mfms_uat_app", "ro": "on"},
                "count": 23, "hash": hotfix.LEDGER_HASH, "rows": [{"timestamp": "original"}], "counts": {str(i): 0 for i in range(6)}}
        hotfix.validate_ledger(good, good)
        for key, value in (("count", 24), ("hash", "0" * 64), ("rows", [{"timestamp": "changed"}]),
                           ("counts", {str(i): 1 for i in range(6)}), ("identity", {"db": "production"})):
            with self.subTest(key=key), self.assertRaises(hotfix.Blocked):
                changed = copy.deepcopy(good)
                changed[key] = value
                hotfix.validate_ledger(changed, good)


class GitGates(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.repo = Path(temporary.name)
        self.git("init", "-q")
        self.git("config", "user.email", "test@invalid.example")
        self.git("config", "user.name", "Isolated Test")
        self.git("config", "core.autocrlf", "false")
        (self.repo / "db").mkdir()
        (self.repo / "db/migration.sql").write_text("baseline ddl\n")
        (self.repo / "source.py").write_text("before\n")
        self.git("add", ".")
        self.git("commit", "-qm", "base")
        self.base = self.git("rev-parse", "HEAD").strip()
        (self.repo / "source.py").write_text("after\n")
        (self.repo / "test.py").write_text("regression\n")
        self.git("add", ".")
        self.git("commit", "-qm", "candidate")
        self.candidate = self.git("rev-parse", "HEAD").strip()
        self.files = {p: hotfix.digest((self.repo / p).read_bytes()) for p in ("source.py", "test.py")}
        self.patches = patch.multiple(hotfix, BASE=self.base, CANDIDATE=self.candidate, FILES=self.files)
        self.patches.start()
        self.addCleanup(self.patches.stop)

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], stderr=subprocess.PIPE).decode()

    def validate(self):
        hotfix.validate_tree(self.repo, hotfix.BRANCH, self.candidate)

    def test_exact_tree_accepted(self):
        self.validate()

    def test_other_branch_and_commit_rejected(self):
        for branch, sha in (("preview-release", self.candidate), (hotfix.BRANCH, self.base)):
            with self.subTest(branch=branch, sha=sha), self.assertRaisesRegex(hotfix.Blocked, "branch or commit"):
                hotfix.validate_tree(self.repo, branch, sha)

    def test_migration_difference_and_extra_file_rejected(self):
        for name in ("db/migration.sql", "frontend.tsx"):
            with self.subTest(name=name):
                self.git("reset", "--hard", self.candidate)
                (self.repo / name).write_text("unauthorized\n")
                self.git("add", name)
                self.git("commit", "--amend", "--no-edit", "-q")
                altered = self.git("rev-parse", "HEAD").strip()
                with patch.object(hotfix, "CANDIDATE", altered), self.assertRaisesRegex(hotfix.Blocked, "extra or missing"):
                    hotfix.validate_tree(self.repo, hotfix.BRANCH, altered)

    def test_altered_reviewed_file_hash_rejected(self):
        with patch.object(hotfix, "FILES", {**self.files, "source.py": "0" * 64}), self.assertRaisesRegex(hotfix.Blocked, "file hash"):
            self.validate()

    def test_dirty_checkout_rejected(self):
        (self.repo / "untracked").write_text("extra")
        with self.assertRaisesRegex(hotfix.Blocked, "dirty"):
            self.validate()


class LostResponseRollback(unittest.TestCase):
    def test_disconnect_rename_and_create_success_with_lost_response(self):
        for stage in ("stop", "disconnect", "rename", "create"):
            with self.subTest(stage=stage):
                live = live_fixture()
                original = copy.deepcopy(live)
                original["State"]["Running"] = False
                if stage != "stop":
                    original["NetworkSettings"]["Networks"] = {}
                if stage in {"rename", "create"}:
                    original["Name"] = "/harvest-api-pilot-coconut-rollback"
                replacement = stage == "create"
                calls = []
                def fake_docker(method, path, payload=None):
                    nonlocal replacement
                    calls.append((method, path))
                    if path == "/containers/json?all=1":
                        return ([{"Id": "replacement", "Names": ["/harvest-api-pilot"], "ImageID": "candidate-image"}] if replacement else [])
                    if method == "DELETE":
                        replacement = False
                    elif "/rename?" in path:
                        original["Name"] = "/harvest-api-pilot"
                    elif path.endswith("/connect"):
                        original["NetworkSettings"] = copy.deepcopy(live["NetworkSettings"])
                    elif path.endswith("/start"):
                        original["State"]["Running"] = True
                def fake_inspect(name=hotfix.NAME):
                    return original
                with patch.object(hotfix, "docker", fake_docker), patch.object(hotfix, "inspect", fake_inspect), \
                     patch.object(hotfix, "health"), patch.object(hotfix, "database_probe"), patch.object(hotfix, "original_unchanged"), \
                     patch.object(hotfix, "BASE_ENV_HASH", hotfix.digest(hotfix.canonical(live["Config"]["Env"]))):
                    hotfix.restore(live, "candidate-image", {})
                self.assertFalse(replacement)
                self.assertEqual(original, live)
                self.assertTrue(any(path.endswith("/start") for _, path in calls))

    def test_unowned_container_is_not_deleted(self):
        rows = [{"Id": "unowned", "Names": ["/harvest-api-pilot"], "ImageID": "wrong-image"}]
        with patch.object(hotfix, "docker", return_value=rows) as call, self.assertRaisesRegex(hotfix.Blocked, "AUTOMATIC ROLLBACK FAILED"):
            hotfix.restore(live_fixture(), "candidate-image", {})
        self.assertEqual(call.call_count, 1)

    def test_shadow_created_with_lost_response_is_removed_by_exact_identity(self):
        rows = [{"Id": "shadow", "Names": ["/owned-shadow"], "ImageID": "candidate-image"}]
        with patch.object(hotfix, "docker", side_effect=[rows, None]) as call:
            hotfix.cleanup_shadow("owned-shadow", "candidate-image")
        self.assertEqual(call.call_args.args, ("DELETE", "/containers/shadow?force=1"))

    def test_shadow_cleanup_refuses_other_image(self):
        rows = [{"Id": "other", "Names": ["/owned-shadow"], "ImageID": "other-image"}]
        with patch.object(hotfix, "docker", return_value=rows) as call, self.assertRaises(hotfix.Blocked):
            hotfix.cleanup_shadow("owned-shadow", "candidate-image")
        self.assertEqual(call.call_count, 1)


if __name__ == "__main__":
    unittest.main()
