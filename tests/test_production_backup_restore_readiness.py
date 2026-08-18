import contextlib
import io
import pathlib
import re
import types
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts" / "production-server-backend-deploy.sh"
MARKER = "PY_DATABASE_BACKUP_FINAL_READINESS"


def load_readiness_module():
    source = HELPER.read_text(encoding="utf-8").replace("\r\n", "\n")
    match = re.search(rf"<<'{MARKER}'\n([\s\S]*?)\n{MARKER}", source)
    if not match:
        raise AssertionError("embedded restore-readiness program is missing")
    namespace = {"__name__": "mfms_restore_readiness"}
    exec(compile(match.group(1), str(HELPER), "exec"), namespace)
    return namespace


class FakeTime:
    def __init__(self):
        self.now = 0.0

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += float(seconds)


class FakeDocker:
    identity = "a" * 64
    database = "mfms_server_prod"

    def __init__(
        self,
        *,
        final_loop=2,
        marker_loop=2,
        never_final=False,
        exit_loop=None,
        identity_change_inspect=None,
        restart_inspect=None,
        failed_probe_indexes=(),
        start_times=(),
    ):
        self.final_loop = final_loop
        self.marker_loop = marker_loop
        self.never_final = never_final
        self.exit_loop = exit_loop
        self.identity_change_inspect = identity_change_inspect
        self.restart_inspect = restart_inspect
        self.failed_probe_indexes = set(failed_probe_indexes)
        self.start_times = list(start_times)
        self.loop = 0
        self.inspect_count = 0
        self.probe_count = 0
        self.pg_isready_loops = []
        self.createdb_count = 0
        self.commands = []

    @staticmethod
    def result(returncode=0, stdout="", stderr=""):
        return types.SimpleNamespace(returncode=returncode, stdout=stdout, stderr=stderr)

    def __call__(self, args):
        self.commands.append(tuple(args))
        if args[1] == "inspect":
            self.inspect_count += 1
            identity = self.identity
            status = "running"
            restarts = 0
            if self.identity_change_inspect == self.inspect_count:
                identity = "b" * 64
            if self.restart_inspect == self.inspect_count:
                restarts = 1
            if self.exit_loop is not None and self.loop >= self.exit_loop:
                status = "exited"
            return self.result(stdout=f"{identity}|{status}|{restarts}\n")
        if args[1] == "logs":
            self.loop += 1
            marker = "PostgreSQL init process complete; ready for start up.\n" if self.loop >= self.marker_loop else ""
            return self.result(stderr=marker)
        if args[1:3] == ["exec", "restore-test"] and args[3] == "sh":
            final = not self.never_final and self.loop >= self.final_loop
            return self.result(stdout="postgres|postgres|1\n" if final else "bash|bash /usr/local/bin/docker-entrypoint.sh postgres|\n")
        if args[1:3] == ["exec", "restore-test"] and args[3] == "pg_isready":
            self.pg_isready_loops.append(self.loop)
            return self.result()
        if args[1:3] == ["exec", "restore-test"] and args[3] == "createdb":
            self.createdb_count += 1
            return self.result()
        if args[1:3] == ["exec", "restore-test"] and args[3] == "psql":
            self.probe_count += 1
            if self.probe_count in self.failed_probe_indexes:
                return self.result(returncode=1)
            index = min(self.probe_count - 1, max(0, len(self.start_times) - 1))
            start_time = self.start_times[index] if self.start_times else "2026-08-18 04:00:00+00"
            return self.result(stdout=f"{self.database}|160011|t|{start_time}\n")
        raise AssertionError(f"unexpected Docker command: {args!r}")


def run_gate(fake, *, timeout=20):
    module = load_readiness_module()
    clock = FakeTime()
    module["run_command"] = fake
    module["time"] = clock
    module["sys"].argv = [
        "restore-readiness",
        "restore-test",
        fake.identity,
        fake.database,
        "16",
        str(timeout),
        "3",
        "2",
    ]
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        module["main"]()
    return output.getvalue(), clock


class RestoreReadinessTests(unittest.TestCase):
    def test_transient_readiness_is_ignored_until_pid_one_is_final_postgres(self):
        fake = FakeDocker(final_loop=3, marker_loop=2)
        output, _ = run_gate(fake)
        self.assertIn("RESTORE_READINESS_TRANSITION=initializing", output)
        self.assertIn("RESTORE_READINESS_STABLE=", output)
        self.assertTrue(fake.pg_isready_loops)
        self.assertTrue(all(loop >= 3 for loop in fake.pg_isready_loops))
        self.assertEqual(fake.createdb_count, 1)

    def test_pid_one_must_be_final_postgres(self):
        fake = FakeDocker(marker_loop=1, never_final=True)
        with self.assertRaises(SystemExit):
            run_gate(fake, timeout=3)
        self.assertEqual(fake.pg_isready_loops, [])
        self.assertEqual(fake.createdb_count, 0)

    def test_shutdown_after_transient_readiness_fails_closed(self):
        fake = FakeDocker(final_loop=3, marker_loop=1, exit_loop=2)
        with self.assertRaises(SystemExit):
            run_gate(fake)
        self.assertEqual(fake.createdb_count, 0)

    def test_postmaster_start_time_change_resets_stability(self):
        fake = FakeDocker(final_loop=1, marker_loop=1, start_times=["A", "A", "B", "B", "B"])
        output, _ = run_gate(fake)
        self.assertEqual(fake.probe_count, 5)
        self.assertIn("RESTORE_READINESS_RESET=postmaster_start_time_changed", output)

    def test_failed_sql_probe_resets_stability(self):
        fake = FakeDocker(final_loop=1, marker_loop=1, failed_probe_indexes=[2])
        output, _ = run_gate(fake)
        self.assertEqual(fake.probe_count, 5)
        self.assertIn("RESTORE_READINESS_RESET=sql_probe_failed", output)

    def test_container_identity_change_fails_closed(self):
        fake = FakeDocker(final_loop=1, marker_loop=1, identity_change_inspect=2)
        with self.assertRaises(SystemExit):
            run_gate(fake)
        self.assertEqual(fake.probe_count, 0)

    def test_container_restart_fails_closed(self):
        fake = FakeDocker(final_loop=1, marker_loop=1, restart_inspect=2)
        with self.assertRaises(SystemExit):
            run_gate(fake)
        self.assertEqual(fake.probe_count, 0)

    def test_timeout_is_bounded_and_never_reaches_restore(self):
        fake = FakeDocker(marker_loop=1, never_final=True)
        with self.assertRaises(SystemExit):
            run_gate(fake, timeout=4)
        self.assertEqual(fake.createdb_count, 0)
        self.assertFalse(any("pg_restore" in command for args in fake.commands for command in args))


if __name__ == "__main__":
    unittest.main()
