#!/usr/bin/env python3
"""Authenticated, append-only adjacent Production frontend rollback records.

The forced-command controller owns the deployment lock. This helper never starts,
stops, renames or removes a container and never connects to a database. Docker
inspection output and environment values remain in memory; records contain hashes.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import tempfile


class Refused(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise Refused(message)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON field")
        result[key] = value
    return result


def parse_json(raw):
    return json.loads(raw, object_pairs_hook=unique_object)


def secure_path(path, *, directory=False, mode=None):
    info = path.lstat()
    require(not stat.S_ISLNK(info.st_mode), "symlink is forbidden")
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode), "invalid file type")
    if os.name != "nt":
        require(info.st_uid == os.getuid(), "incorrect owner")
        require(stat.S_IMODE(info.st_mode) == mode if mode else not info.st_mode & 0o077, "unsafe permissions")
    require(directory or info.st_nlink == 1, "hard-linked protected file is forbidden")


def read_safe(path, *, mode=None):
    secure_path(path, mode=mode)
    with os.fdopen(os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)), "rb") as source:
        info = os.fstat(source.fileno())
        require(info.st_ino == path.lstat().st_ino, "file changed while opening")
        return source.read(1_048_577)


def fsync_directory(path):
    if os.name != "nt":
        descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def atomic_write(path, raw, *, immutable=False):
    require(len(raw) <= 1_048_576, "record is oversized")
    temporary_fd, temporary_name = tempfile.mkstemp(prefix=".rollback-", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(temporary_fd, "wb") as output:
            output.write(raw)
            output.flush()
            os.fchmod(output.fileno(), 0o400 if immutable else 0o600) if os.name != "nt" else None
            os.fsync(output.fileno())
        if immutable:
            # A hard link publishes a fully fsynced file atomically without overwrite.
            os.link(temporary, path)
            temporary.unlink()
        else:
            if path.exists() or path.is_symlink():
                secure_path(path, mode=0o600)
            os.replace(temporary, path)
        fsync_directory(path.parent)
    finally:
        if temporary.exists():
            temporary.unlink()


def parse_state(raw):
    result = {}
    for line in raw.decode("utf-8").splitlines():
        require("=" in line, "invalid release state")
        key, value = line.split("=", 1)
        require(key not in result and re.fullmatch(r"[a-z_]+", key), "duplicate/invalid state key")
        result[key] = value
    return result


def state_bytes(state):
    return "".join(f"{key}={value}\n" for key, value in state.items()).encode()


def inspect_container(name):
    require(re.fullmatch(r"mfms-v0-preview-web(?:-[a-zA-Z0-9-]+)?", name), "invalid container name")
    raw = subprocess.check_output(["docker", "inspect", name], stderr=subprocess.DEVNULL)
    item = parse_json(raw)[0]
    image = parse_json(subprocess.check_output(["docker", "image", "inspect", item["Image"]], stderr=subprocess.DEVNULL))[0]
    network = parse_json(subprocess.check_output(["docker", "network", "inspect", "harvest-net"], stderr=subprocess.DEVNULL))[0]
    return snapshot(item, image, network)


def snapshot(item, image, network=None):
    config, host = item["Config"], item["HostConfig"]
    entries = config.get("Env") or []
    env = {}
    for entry in entries:
        key, separator, value = entry.partition("=")
        require(separator and key not in env, "duplicate/invalid environment entry")
        env[key] = value
    require(env.get("MFMS_ENV") == "production", "wrong runtime environment")
    require(env.get("MFMS_TARGET_DATABASE") == "mfms_server_prod", "wrong target database")
    require(env.get("NEXT_PUBLIC_MFMS_ENV", "production") == "production", "wrong public environment")
    require(env.get("NEXT_PUBLIC_MFMS_TARGET_DATABASE", "mfms_server_prod") == "mfms_server_prod", "wrong public database")
    require(env.get("NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL") == "mfms_server_prod", "wrong public database label")
    require(env.get("HARVEST_API_BASE_URL") == "http://harvest-api:8000", "wrong Production backend URL")
    labels = image["Config"].get("Labels") or {}
    revision = labels.get("org.opencontainers.image.revision", "")
    require(re.fullmatch(r"[0-9a-f]{40}", revision), "invalid image revision")
    require(labels.get("com.muthufarms.mfms.environment") == "Production", "wrong image environment")
    require(image["Id"] == item["Image"], "image identity mismatch")
    require(env.get("MFMS_GIT_COMMIT") == revision, "runtime revision mismatch")
    require(item["Mounts"] == [], "unapproved frontend mount contract")
    require(host["NetworkMode"] == "harvest-net", "wrong network mode")
    require(host["PortBindings"] == {"3000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "3014"}]}, "wrong port binding")
    require(host["RestartPolicy"] == {"Name": "unless-stopped", "MaximumRetryCount": 0}, "wrong restart policy")
    require(not host.get("Privileged") and not host.get("CapAdd"), "unapproved container privileges")
    require(not host.get("PidMode") and not host.get("IpcMode") == "host", "unapproved host namespace")
    require(re.fullmatch(r"[0-9a-f]{64}", item["Id"]), "invalid container identity")
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", item["Image"]), "invalid image identity")
    require(isinstance(item["State"]["Running"], bool), "invalid running state")
    require(isinstance(item["RestartCount"], int) and not isinstance(item["RestartCount"], bool) and item["RestartCount"] >= 0, "invalid restart history")
    networks = item["NetworkSettings"]["Networks"]
    require(not set(networks) - {"harvest-net"}, "unapproved network attachment")
    endpoint = networks.get("harvest-net", {})
    require(not endpoint.get("Aliases") and not endpoint.get("Links") and not endpoint.get("DriverOpts"), "unapproved network endpoint options")
    require(not endpoint.get("GlobalIPv6Address"), "unapproved IPv6 endpoint")
    ipam = endpoint.get("IPAMConfig")
    require(ipam is None or isinstance(ipam, dict), "invalid endpoint IPAM configuration")
    ipam = ipam or {}
    require(not set(ipam) - {"IPv4Address", "IPv6Address", "LinkLocalIPs"}, "unapproved static endpoint options")
    require(ipam.get("IPv4Address", "172.19.128.7") == "172.19.128.7", "unapproved static endpoint")
    # Docker may serialize empty IPv6/list defaults on an IPv4-only endpoint.
    # They carry no address capability; all nonempty or mistyped values reject.
    require(ipam.get("IPv6Address", "") == "", "unapproved static IPv6 endpoint")
    require(ipam.get("LinkLocalIPs") is None or ipam.get("LinkLocalIPs") == [], "unapproved link-local endpoint")
    ip = endpoint.get("IPAddress", "")
    require(ip in {"", "172.19.128.7"}, "wrong Production address")
    if network is not None:
        require(network["Name"] == "harvest-net" and network["Driver"] == "bridge", "wrong Production network")
        require(network["IPAM"]["Config"] == [{"Subnet": "172.19.0.0/16", "IPRange": "172.19.128.0/17", "Gateway": "172.19.0.1"}], "wrong Production IPAM")
        require(not endpoint.get("NetworkID") or endpoint["NetworkID"] == network["Id"], "endpoint network identity mismatch")
    static = {
        "container_id": item["Id"], "revision": revision, "image_id": item["Image"],
        "environment_sha256": digest(("\n".join(sorted(entries)) + "\n").encode()),
        "host_config_sha256": digest(canonical(host)), "mounts": [],
        "mount_policy": "production-frontend-base-v1", "database": "mfms_server_prod",
        "environment": "Production", "network": "harvest-net", "production_ip": "172.19.128.7",
        "network_id": network["Id"] if network is not None else "hermetic-fixture",
        "restart_count": item["RestartCount"],
    }
    return {"static": static, "running": item["State"]["Running"], "ip": ip}


class Records:
    def __init__(self, state_dir, *, inspect=inspect_container):
        self.root = Path(state_dir)
        secure_path(self.root, directory=True, mode=0o700)
        if os.name != "nt":
            for parent in self.root.parents:
                info = parent.lstat()
                require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), "unsafe parent directory")
                require(info.st_uid in {0, os.getuid()} and not info.st_mode & 0o022, "unsafe parent ownership/permissions")
        self.directory = self.root / "frontend-rollback-records"
        self.key_path = self.root / "frontend-rollback-signing.key"
        self.state_path = self.root / "last-successful-frontend-switch"
        self.inspect = inspect

    def initialize(self):
        if not self.directory.exists():
            self.directory.mkdir(mode=0o700)
        secure_path(self.directory, directory=True, mode=0o700)
        if not self.key_path.exists():
            require(not any(self.directory.iterdir()), "signing key missing for existing records")
            atomic_write(self.key_path, secrets.token_bytes(32), immutable=True)
        require(len(read_safe(self.key_path, mode=0o400)) == 32, "invalid signing key")

    def key(self):
        secure_path(self.directory, directory=True, mode=0o700)
        key = read_safe(self.key_path, mode=0o400)
        require(len(key) == 32, "invalid signing key")
        return key

    def path(self, identity, kind):
        require(re.fullmatch(r"[0-9]+-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}", identity), "invalid deployment ID")
        require(kind in {"prepare", "deployment", "rollback"}, "invalid record kind")
        return self.directory / f"{identity}.{kind}.json"

    def save(self, identity, kind, payload):
        envelope = {"payload": payload, "signature": hmac.new(self.key(), canonical(payload), hashlib.sha256).hexdigest()}
        atomic_write(self.path(identity, kind), canonical(envelope) + b"\n", immutable=True)

    def load(self, identity, kind):
        envelope = parse_json(read_safe(self.path(identity, kind), mode=0o400))
        require(set(envelope) == {"payload", "signature"}, "invalid record envelope")
        expected = hmac.new(self.key(), canonical(envelope["payload"]), hashlib.sha256).hexdigest()
        require(isinstance(envelope["signature"], str) and hmac.compare_digest(expected, envelope["signature"]), "record signature mismatch")
        payload = envelope["payload"]
        require(payload.get("deployment_id") == identity and payload.get("kind") == kind, "record binding mismatch")
        return payload

    def state(self):
        raw = read_safe(self.state_path, mode=0o600)
        require(len(raw) <= 65536, "release state is oversized")
        return parse_state(raw), digest(raw)

    @staticmethod
    def match(actual, expected, *, running):
        require(actual["static"] == expected, "container/image/environment/configuration drift")
        require(actual["running"] == running, "container running state mismatch")
        require(actual["ip"] == ("172.19.128.7" if running else ""), "container network attachment mismatch")

    @staticmethod
    def match_source(actual, expected):
        observed, recorded = dict(actual["static"]), dict(expected)
        observed_restarts = observed.pop("restart_count")
        recorded_restarts = recorded.pop("restart_count")
        require(observed == recorded, "source container/image/environment/configuration drift")
        require(isinstance(observed_restarts, int) and observed_restarts >= recorded_restarts, "invalid source restart history")
        # Crash-loop counters and running state may change after the deployment
        # workflow exits. They must not disable restoration of the exact artifact.
        require(actual["ip"] in {"", "172.19.128.7"}, "source network attachment mismatch")

    def stage(self, identity, revision, image_id, target_name, run_id, timestamp, *, enrollment_hash=None):
        require(identity.startswith(f"{run_id}-{timestamp}-"), "deployment ID/run binding mismatch")
        state, state_hash = self.state()
        source = self.inspect("mfms-v0-preview-web")
        self.match(source, source["static"], running=True)
        require(state["deployed_revision"] == source["static"]["revision"] and state["deployed_image_id"] == source["static"]["image_id"], "live release differs from state")
        require(re.fullmatch(r"[0-9a-f]{40}", revision) and re.fullmatch(r"sha256:[0-9a-f]{64}", image_id), "invalid candidate")
        require(re.fullmatch(r"mfms-v0-preview-web-pre-[a-zA-Z0-9-]+", target_name), "invalid adjacent target name")
        if enrollment_hash:
            require(state_hash == enrollment_hash, "legacy enrollment state changed")
            require("rollback_record_id" not in state and "rollback_receipt_id" not in state, "legacy state was already enrolled")
            target = self.inspect(target_name)
            self.match(target, target["static"], running=False)
            require(state["rollback_container"] == target_name and state["rollback_revision"] == target["static"]["revision"] and state["rollback_image_id"] == target["static"]["image_id"], "legacy adjacent target mismatch")
            previous = target["static"]
        else:
            previous = source["static"]
        self.save(identity, "prepare", {
            "kind": "prepare", "deployment_id": identity, "revision": revision, "image_id": image_id,
            "target_name": target_name, "previous": previous, "source_state_sha256": state_hash,
            "run_id": run_id, "timestamp": timestamp, "enrollment": bool(enrollment_hash),
            "source_state": state,
        })

    def finalize(self, identity, image_tag, previous_image_tag):
        preparation = self.load(identity, "prepare")
        require(self.state()[1] == preparation["source_state_sha256"], "release state changed before activation")
        current = self.inspect("mfms-v0-preview-web")
        target = self.inspect(preparation["target_name"])
        self.match(target, preparation["previous"], running=False)
        require(current["static"]["revision"] == preparation["revision"] and current["static"]["image_id"] == preparation["image_id"], "candidate differs from preparation")
        require(current["running"] == preparation["enrollment"], "candidate was activated before recording")
        committed = {
            "deployed_revision": preparation["revision"], "deployed_image_id": preparation["image_id"], "deployed_image_tag": image_tag,
            "rollback_container": preparation["target_name"], "rollback_revision": target["static"]["revision"],
            "rollback_image_id": target["static"]["image_id"], "rollback_image_tag": previous_image_tag,
            "run_id": preparation["run_id"], "updated_at": preparation["timestamp"],
            "rollback_record_id": identity,
        }
        self.save(identity, "deployment", {
            "kind": "deployment", "deployment_id": identity, "preparation_sha256": digest(canonical(preparation)),
            "current": current["static"], "previous": target["static"], "target_name": preparation["target_name"],
            "committed_state": committed,
        })

    def deployment(self, identity):
        record = self.load(identity, "deployment")
        preparation = self.load(identity, "prepare")
        require(record["preparation_sha256"] == digest(canonical(preparation)), "preparation link mismatch")
        require(record["previous"] == preparation["previous"], "adjacent target link mismatch")
        return record, preparation

    def activate(self, identity):
        record, preparation = self.deployment(identity)
        require(self.state()[1] == preparation["source_state_sha256"], "release state changed before commit")
        self.match(self.inspect("mfms-v0-preview-web"), record["current"], running=True)
        self.match(self.inspect(record["target_name"]), record["previous"], running=False)
        atomic_write(self.state_path, state_bytes(record["committed_state"]))

    def verify(self, expected_revision):
        state, _ = self.state()
        identity = state.get("rollback_record_id", "")
        record, _ = self.deployment(identity)
        require(expected_revision == record["current"]["revision"], "requested revision is not this deployment")
        if "rollback_receipt_id" in state:
            receipt = self.load(state["rollback_receipt_id"], "rollback")
            require(receipt["source_deployment_id"] == identity and receipt["deployment_sha256"] == digest(canonical(record)), "rollback receipt link mismatch")
            require(state == receipt["committed_state"], "restored release state drift")
            self.match(self.inspect("mfms-v0-preview-web"), record["previous"], running=True)
            retained = self.inspect(receipt["retained_name"])
            self.match_source(retained, record["current"])
            require(not retained["running"] and not retained["ip"], "retained source is not detached/stopped")
            return {"status": "already-complete", "deployment_id": identity, "target": record["previous"], "target_name": "mfms-v0-preview-web"}
        require(state == record["committed_state"], "release state/record mismatch")
        self.match_source(self.inspect("mfms-v0-preview-web"), record["current"])
        self.match(self.inspect(record["target_name"]), record["previous"], running=False)
        return {"status": "ready", "deployment_id": identity, "target": record["previous"], "target_name": record["target_name"]}

    def rollback_receipt(self, identity, receipt_id, retained_name, run_id, timestamp):
        record, _ = self.deployment(identity)
        require(self.state()[0] == record["committed_state"], "rollback source state changed")
        self.match(self.inspect("mfms-v0-preview-web"), record["previous"], running=True)
        retained = self.inspect(retained_name)
        self.match_source(retained, record["current"])
        require(not retained["running"] and not retained["ip"], "retained source is not detached/stopped")
        previous_state = record["committed_state"]
        committed = {
            "deployed_revision": record["previous"]["revision"], "deployed_image_id": record["previous"]["image_id"], "deployed_image_tag": previous_state["rollback_image_tag"],
            "rollback_container": retained_name, "rollback_revision": record["current"]["revision"], "rollback_image_id": record["current"]["image_id"],
            "rollback_image_tag": previous_state["deployed_image_tag"], "run_id": run_id, "updated_at": timestamp,
            "rollback_record_id": identity, "rollback_receipt_id": receipt_id,
        }
        self.save(receipt_id, "rollback", {
            "kind": "rollback", "deployment_id": receipt_id, "source_deployment_id": identity,
            "deployment_sha256": digest(canonical(record)), "retained_name": retained_name, "committed_state": committed,
        })
        atomic_write(self.state_path, state_bytes(committed))

    def restored(self, identity, operation):
        if operation == "rollback":
            record, _ = self.deployment(identity)
            source = self.inspect("mfms-v0-preview-web")
            self.match_source(source, record["current"])
            require(source["running"], "restored source is not running")
            self.match(self.inspect(record["target_name"]), record["previous"], running=False)
            require(self.state()[0] == record["committed_state"], "rollback recovery state mismatch")
        else:
            require(operation == "deploy", "invalid recovery operation")
            preparation = self.load(identity, "prepare")
            self.match(self.inspect("mfms-v0-preview-web"), preparation["previous"], running=True)
            require(self.state()[1] == preparation["source_state_sha256"], "deployment recovery state mismatch")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("operation", choices=["initialize", "stage", "finalize", "activate", "verify", "receipt", "restored"])
    parser.add_argument("values", nargs="*")
    args = parser.parse_args()
    records = Records(args.state_dir)
    if args.operation == "initialize":
        records.initialize()
    elif args.operation == "stage":
        records.stage(*args.values[:6], enrollment_hash=args.values[6] if len(args.values) == 7 else None)
    elif args.operation == "finalize":
        records.finalize(*args.values)
    elif args.operation == "activate":
        records.activate(*args.values)
    elif args.operation == "verify":
        print(json.dumps(records.verify(*args.values), sort_keys=True))
    elif args.operation == "receipt":
        records.rollback_receipt(*args.values)
    elif args.operation == "restored":
        records.restored(*args.values)


if __name__ == "__main__":
    try:
        main()
    except (Refused, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        raise SystemExit("PRODUCTION_FRONTEND_ROLLBACK_RECORD=BLOCKED (record, artifact or configuration validation failed)")
