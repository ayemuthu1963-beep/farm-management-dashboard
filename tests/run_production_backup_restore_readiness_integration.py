#!/usr/bin/env python3
import argparse
import json
import pathlib
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time


ROOT = pathlib.Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts" / "production-server-backend-deploy.sh"
MARKER = "PY_DATABASE_BACKUP_FINAL_READINESS"


def run(args, *, check=True, input_bytes=None, capture=True):
    return subprocess.run(
        args,
        check=check,
        input=input_bytes,
        capture_output=capture,
        text=input_bytes is None,
    )


def docker(*args, **kwargs):
    return run(["docker", *args], **kwargs)


def wait_for_final(container, timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        state = docker("inspect", "--format", "{{.State.Status}}|{{.RestartCount}}", container).stdout.strip()
        process = docker(
            "exec",
            container,
            "sh",
            "-c",
            "printf '%s|%s\\n' \"$(cat /proc/1/comm 2>/dev/null || true)\" \"$(sed -n '1p' /var/lib/postgresql/data/postmaster.pid 2>/dev/null || true)\"",
            check=False,
        ).stdout.strip()
        ready = docker("exec", container, "pg_isready", "--username=postgres", "--dbname=postgres", check=False)
        if state == "running|0" and process == "postgres|1" and ready.returncode == 0:
            return
        time.sleep(0.25)
    raise RuntimeError("source PostgreSQL final server did not become ready")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default="postgres:16")
    args = parser.parse_args()
    suffix = secrets.token_hex(5)
    source_container = f"mfms-readiness-source-{suffix}"
    target_container = f"mfms-readiness-target-{suffix}"
    source_volume = f"mfms-readiness-source-{suffix}-data"
    resources = [source_container, target_container]
    volumes = [source_volume]
    temp_dir = pathlib.Path(tempfile.mkdtemp(prefix="mfms-readiness-integration-"))
    dump_path = temp_dir / "sample.dump"
    init_script = temp_dir / "observe-transient.sh"
    readiness_script = temp_dir / "readiness.py"
    try:
        helper_text = HELPER.read_text(encoding="utf-8").replace("\r\n", "\n")
        match = re.search(rf"<<'{MARKER}'\n([\s\S]*?)\n{MARKER}", helper_text)
        if not match:
            raise RuntimeError("embedded restore-readiness program is missing")
        readiness_script.write_text(match.group(1) + "\n", encoding="utf-8")
        init_script.write_bytes(
            b"#!/bin/sh\necho MFMS_READINESS_TEST_TRANSIENT_SERVER\nsleep 5\n"
        )
        init_script.chmod(0o755)

        docker("volume", "create", source_volume)

        docker(
            "run", "-d", "--name", source_container, "--network", "none", "--restart", "no",
            "--mount", f"type=volume,source={source_volume},target=/var/lib/postgresql/data,volume-nocopy",
            "--env", "POSTGRES_HOST_AUTH_METHOD=trust", args.image,
        )
        wait_for_final(source_container)
        docker("exec", source_container, "createdb", "--username=postgres", "--template=template0", "mfms_server_prod")
        docker(
            "exec", source_container, "psql", "--username=postgres", "--dbname=mfms_server_prod",
            "--set=ON_ERROR_STOP=1", "--command=CREATE TABLE readiness_evidence(id integer primary key, value text not null); INSERT INTO readiness_evidence VALUES (1, 'restored-after-final-readiness');",
        )
        dump = subprocess.run(
            ["docker", "exec", source_container, "pg_dump", "--username=postgres", "--dbname=mfms_server_prod",
             "--format=custom", "--no-owner", "--no-privileges"],
            capture_output=True,
            check=True,
        )
        dump_path.write_bytes(dump.stdout)
        if dump_path.stat().st_size == 0 or dump_path.read_bytes()[:5] != b"PGDMP":
            raise RuntimeError("integration dump is not a non-empty custom-format archive")

        docker(
            "run", "-d", "--name", target_container, "--network", "none", "--restart", "no",
            "--mount", "type=tmpfs,target=/var/lib/postgresql/data,tmpfs-size=2147483648,tmpfs-mode=0700",
            "--mount", f"type=bind,source={init_script},target=/docker-entrypoint-initdb.d/observe-transient.sh,readonly",
            "--env", "POSTGRES_HOST_AUTH_METHOD=trust", args.image,
        )
        mounts = json.loads(
            docker(
                "inspect", "--format", "{{json .HostConfig.Mounts}}", target_container
            ).stdout
        )
        target_mounts = [
            mount
            for mount in mounts
            if mount.get("Type") == "tmpfs"
            and mount.get("Target") == "/var/lib/postgresql/data"
        ]
        options = target_mounts[0].get("TmpfsOptions") if len(target_mounts) == 1 else {}
        if options.get("SizeBytes") != 2147483648 or options.get("Mode") != 0o700:
            raise RuntimeError("target restore tmpfs does not enforce the 2 GiB capacity bound")
        target_id = docker("inspect", "--format", "{{.Id}}", target_container).stdout.strip()
        gate = subprocess.Popen(
            [sys.executable, str(readiness_script), target_container, target_id, "mfms_server_prod", "16", "120", "3", "1"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        observed_transient = False
        while gate.poll() is None:
            pid1 = docker("exec", target_container, "cat", "/proc/1/comm", check=False).stdout.strip()
            ready = docker("exec", target_container, "pg_isready", "--username=postgres", "--dbname=postgres", check=False)
            if pid1 != "postgres" and ready.returncode == 0:
                observed_transient = True
            time.sleep(0.1)
        gate_output = gate.stdout.read() if gate.stdout is not None else ""
        if gate.returncode != 0:
            target_logs = docker("logs", target_container, check=False).stderr
            raise RuntimeError(
                f"stable final-server gate failed:\n{gate_output}\n"
                f"target PostgreSQL logs:\n{target_logs}"
            )
        if not observed_transient:
            raise RuntimeError("integration did not observe transient initialization-server readiness")
        if "RESTORE_READINESS_STABLE=" not in gate_output:
            raise RuntimeError("stable final-server evidence is missing")

        with dump_path.open("rb") as dump_file:
            restored = subprocess.run(
                ["docker", "exec", "-i", target_container, "pg_restore", "--exit-on-error", "--no-owner", "--no-privileges", "--username=postgres", "--dbname=mfms_server_prod"],
                stdin=dump_file,
                capture_output=True,
                check=False,
            )
        if restored.returncode != 0:
            raise RuntimeError("pg_restore failed after stable final readiness")
        value = docker(
            "exec", target_container, "psql", "--username=postgres", "--dbname=mfms_server_prod",
            "--no-psqlrc", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1",
            "--command=SELECT value FROM readiness_evidence WHERE id = 1;",
        ).stdout.strip()
        if value != "restored-after-final-readiness":
            raise RuntimeError("restored data validation failed")
        print("TRANSIENT_INITIALIZATION_READINESS_OBSERVED=true")
        print(gate_output.strip())
        print(f"RESTORE_ARCHIVE_BYTES={dump_path.stat().st_size}")
        print("RESTORE_AFTER_STABLE_FINAL_SERVER=true")
        print("RESTORED_DATA_VALIDATED=true")
    finally:
        for container in resources:
            docker("rm", "-f", container, check=False)
        for volume in volumes:
            docker("volume", "rm", "-f", volume, check=False)
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
