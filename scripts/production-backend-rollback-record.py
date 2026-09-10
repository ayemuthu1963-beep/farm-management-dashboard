#!/usr/bin/env python3
"""Authenticated, append-only adjacent Production backend rollback records.

The forced-command controller owns the deployment lock. This helper never starts,
stops, renames or removes a container and never connects to a database. Docker
inspection output and environment values remain in memory; records contain hashes.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import tempfile
from urllib.parse import urlsplit


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
    require(result.get("database_migrations") == "forward-only", "invalid migration policy")
    return result


def state_bytes(state):
    return "".join(f"{key}={value}\n" for key, value in state.items()).encode()


BASE_MOUNTS = sorted([
    ["bind", "/home/muthu/mfms_data/production/motor-screenshot-analysis", "/var/lib/mfms/motor-screenshot-analysis", True],
    ["bind", "/tmp", "/host-tmp", True],
])
INTELLIGENCE_KEY_SOURCE = "/home/muthu/.local/state/mfms-production-intelligence/production_service_key"
INTELLIGENCE_KEY_TARGET = "/run/secrets/mfms_intelligence_production_key"
INTELLIGENCE_MOUNTS = sorted(BASE_MOUNTS + [["bind", INTELLIGENCE_KEY_SOURCE, INTELLIGENCE_KEY_TARGET, False]])
INTELLIGENCE_ENVIRONMENT = {
    "MFMS_INTELLIGENCE_ENABLED": "true",
    "MFMS_INTELLIGENCE_URL": "http://10.122.0.3:8765",
    "MFMS_INTELLIGENCE_SERVICE_ID": "mfms-production-backend",
    "MFMS_INTELLIGENCE_SERVICE_KEY_FILE": INTELLIGENCE_KEY_TARGET,
}


def inspect_artifact(name):
    require(re.fullmatch(r"harvest-api(?:-[a-zA-Z0-9-]+)?", name), "invalid container name")
    require(not name.startswith("harvest-api-pilot"), "Preview target forbidden")
    raw = subprocess.check_output(["docker", "inspect", name], stderr=subprocess.DEVNULL)
    items = parse_json(raw)
    require(isinstance(items, list) and len(items) == 1 and items[0]["Name"] == "/" + name, "container lookup mismatch")
    item = items[0]
    images = parse_json(subprocess.check_output(["docker", "image", "inspect", item["Image"]], stderr=subprocess.DEVNULL))
    networks = parse_json(subprocess.check_output(["docker", "network", "inspect", "harvest-net"], stderr=subprocess.DEVNULL))
    require(isinstance(images, list) and len(images) == 1 and isinstance(networks, list) and len(networks) == 1,
            "ambiguous artifact lookup")
    image, network = images[0], networks[0]
    owner_items = {}
    for identity in active_address_owners(network):
        if identity == item["Id"]:
            owner_items[identity] = item
        else:
            owners = parse_json(subprocess.check_output(["docker", "inspect", identity], stderr=subprocess.DEVNULL))
            require(isinstance(owners, list) and len(owners) == 1 and owners[0]["Id"] == identity,
                    "active owner inspection mismatch")
            owner_items[identity] = owners[0]
    return item, image, network, owner_items


def inspect_container(name):
    item, image, network, owner_items = inspect_artifact(name)
    result = snapshot(item, image, network, owner_items=owner_items)
    if result["static"]["mount_policy"] == "production-intelligence-v1":
        secure_path(Path(INTELLIGENCE_KEY_SOURCE).parent, directory=True, mode=0o700)
        secure_path(Path(INTELLIGENCE_KEY_SOURCE), mode=0o400)
    return result


def active_address_owners(network):
    owners = network["Containers"]
    require(isinstance(owners, dict), "invalid network owners")
    active = {}
    for identity, owner in owners.items():
        require(re.fullmatch(r"[0-9a-f]{64}", identity) and isinstance(owner, dict), "invalid network owner identity")
        address = owner.get("IPv4Address")
        require(isinstance(address, str) and address, "invalid network owner address")
        parsed = ipaddress.IPv4Interface(address)
        require(parsed.network.prefixlen == 16 and str(parsed) == address, "noncanonical network owner address")
        require(parsed.ip in ipaddress.IPv4Network("172.19.0.0/16"), "out-of-subnet network owner")
        if str(parsed.ip) == "172.19.0.2":
            active[identity] = owner
    # Cardinality is unconditional, including the two authenticated artifacts.
    require(len(active) <= 1, "multiple active Production address owners")
    return active


def network_state(item, network, *, check_conflicts=True, owner_items=None):
    require(network["Name"] == "harvest-net" and network["Driver"] == "bridge", "wrong Production network")
    require(re.fullmatch(r"[0-9a-f]{64}", network["Id"]), "invalid network identity")
    require(network["IPAM"]["Config"] == [{"Subnet": "172.19.0.0/16", "IPRange": "172.19.128.0/17", "Gateway": "172.19.0.1"}],
            "wrong Production IPAM")
    running = item["State"]["Running"]
    require(type(running) is bool, "invalid running state")
    require(all(item["State"].get(key) is False for key in ("Paused", "Restarting", "Dead")), "unsafe container lifecycle state")
    networks = item["NetworkSettings"]["Networks"]
    require(isinstance(networks, dict) and not set(networks) - {"harvest-net"}, "unapproved network attachment")
    owners = network["Containers"]
    active = active_address_owners(network)
    if owner_items is None:
        owner_items = {item["Id"]: item} if item["Id"] in active else {}
    require(isinstance(owner_items, dict) and set(owner_items) == set(active), "missing active owner lifecycle proof")
    for identity, owner in active.items():
        actual = owner_items[identity]
        require(actual["Id"] == identity and actual["State"]["Running"] is True
                and all(actual["State"].get(key) is False for key in ("Paused", "Restarting", "Dead")),
                "active owner lifecycle mismatch")
        actual_networks = actual["NetworkSettings"]["Networks"]
        require(isinstance(actual_networks, dict) and set(actual_networks) == {"harvest-net"}, "active owner network mismatch")
        actual_endpoint = actual_networks["harvest-net"]
        require(actual_endpoint.get("NetworkID") == network["Id"]
                and isinstance(owner.get("EndpointID"), str) and re.fullmatch(r"[0-9a-f]{64}", owner["EndpointID"])
                and actual_endpoint.get("EndpointID") == owner["EndpointID"]
                and actual_endpoint.get("IPAddress") == "172.19.0.2"
                and isinstance(actual_endpoint.get("IPAMConfig"), dict)
                and actual_endpoint["IPAMConfig"].get("IPv4Address") == "172.19.0.2",
                "active owner endpoint mismatch")
        require(not check_conflicts or identity == item["Id"], "Production address conflict")
    if "harvest-net" not in networks:
        require(not running and item["Id"] not in owners, "missing live network attachment")
        return {"attached": False, "running": False, "ip": "", "static_ip": ""}
    endpoint = networks["harvest-net"]
    require(isinstance(endpoint, dict), "invalid network endpoint")
    require(endpoint.get("NetworkID") in ("", network["Id"]), "endpoint network identity mismatch")
    runtime_ip = endpoint.get("IPAddress")
    require(isinstance(runtime_ip, str) and runtime_ip in {"", "172.19.0.2"}, "invalid Production runtime address")
    ipam = endpoint.get("IPAMConfig")
    require(isinstance(ipam, dict) and ipam.get("IPv4Address") == "172.19.0.2", "unverified Production static address")
    require(not set(ipam) - {"IPv4Address", "IPv6Address", "LinkLocalIPs"}
            and ipam.get("IPv6Address", "") == "" and ipam.get("LinkLocalIPs") in (None, []), "invalid endpoint IPAM")
    require(isinstance(endpoint.get("EndpointID"), str), "invalid endpoint identity")
    if running:
        require(runtime_ip == "172.19.0.2" and endpoint["NetworkID"] == network["Id"]
                and re.fullmatch(r"[0-9a-f]{64}", endpoint["EndpointID"]), "unverified running endpoint")
        require(item["Id"] in owners and owners[item["Id"]]["IPv4Address"] == "172.19.0.2/16"
                and owners[item["Id"]].get("EndpointID") == endpoint["EndpointID"], "missing active endpoint ownership")
    else:
        require(runtime_ip == "" and endpoint["EndpointID"] == "" and item["Id"] not in owners, "unverified stopped endpoint")
    return {"attached": True, "running": running, "ip": runtime_ip, "static_ip": "172.19.0.2"}


def snapshot(item, image, network=None, *, owner_items=None):
    config, host = item["Config"], item["HostConfig"]
    require("OomKillDisable" in host and (host["OomKillDisable"] is False or host["OomKillDisable"] is None),
            "unapproved OOM-kill configuration")
    entries = config.get("Env") or []
    env = {}
    for entry in entries:
        key, separator, value = entry.partition("=")
        require(separator and key not in env, "duplicate/invalid environment entry")
        env[key] = value
    require(env.get("MFMS_ENV") == "production", "wrong runtime environment")
    require(env.get("MFMS_TARGET_DATABASE") == "mfms_server_prod", "wrong target database")
    database_url = urlsplit(env.get("DATABASE_URL", ""))
    require(database_url.path == "/mfms_server_prod" and not database_url.query and not database_url.fragment, "wrong database URL target")
    labels = image["Config"].get("Labels") or {}
    revision = labels.get("org.opencontainers.image.revision", "")
    require(re.fullmatch(r"[0-9a-f]{40}", revision), "invalid image revision")
    require(labels.get("com.muthufarms.mfms.environment") == "Production", "wrong image environment")
    require(image["Id"] == item["Image"], "image identity mismatch")
    require(env.get("MFMS_GIT_COMMIT") == revision, "runtime revision mismatch")
    mounts = sorted([[m["Type"], m["Source"], m["Destination"], m["RW"]] for m in item["Mounts"]])
    if mounts == BASE_MOUNTS:
        require(env.get("MFMS_INTELLIGENCE_ENABLED", "false") == "false", "Intelligence requires its read-only credential mount")
        mount_policy = "production-backend-base-v1"
    elif mounts == INTELLIGENCE_MOUNTS:
        require(all(env.get(key) == value for key, value in INTELLIGENCE_ENVIRONMENT.items()), "Intelligence environment/credential identity mismatch")
        mount_policy = "production-intelligence-v1"
    else:
        raise Refused("unapproved mount contract")
    require(host["NetworkMode"] == "harvest-net", "wrong network mode")
    require(host["PortBindings"] == {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8001"}]}, "wrong port binding")
    require(host["RestartPolicy"] == {"Name": "unless-stopped", "MaximumRetryCount": 0}, "wrong restart policy")
    require(not host.get("Privileged") and not host.get("CapAdd"), "unapproved container privileges")
    require(not host.get("PidMode") and not host.get("IpcMode") == "host", "unapproved host namespace")
    require(re.fullmatch(r"[0-9a-f]{64}", item["Id"]), "invalid container identity")
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", item["Image"]), "invalid image identity")
    networks = item["NetworkSettings"]["Networks"]
    require(not set(networks) - {"harvest-net"}, "unapproved network attachment")
    endpoint = networks.get("harvest-net", {})
    require(not endpoint.get("Aliases") and not endpoint.get("Links") and not endpoint.get("DriverOpts"), "unapproved network endpoint options")
    require(not endpoint.get("GlobalIPv6Address"), "unapproved IPv6 endpoint")
    ipam = endpoint.get("IPAMConfig")
    require(ipam is None or isinstance(ipam, dict), "invalid endpoint IPAM configuration")
    ipam = ipam or {}
    require(not set(ipam) - {"IPv4Address", "IPv6Address", "LinkLocalIPs"}, "unapproved static endpoint options")
    require(ipam.get("IPv4Address", "172.19.0.2") == "172.19.0.2", "unapproved static endpoint")
    # Docker may serialize empty IPv6/list defaults on an IPv4-only endpoint.
    # They carry no address capability; all nonempty or mistyped values reject.
    require(ipam.get("IPv6Address", "") == "", "unapproved static IPv6 endpoint")
    require(ipam.get("LinkLocalIPs") is None or ipam.get("LinkLocalIPs") == [], "unapproved link-local endpoint")
    ip = endpoint.get("IPAddress", "")
    require(ip in {"", "172.19.0.2"}, "wrong Production address")
    if network is not None:
        require(network["Name"] == "harvest-net" and network["Driver"] == "bridge", "wrong Production network")
        require(network["IPAM"]["Config"] == [{"Subnet": "172.19.0.0/16", "IPRange": "172.19.128.0/17", "Gateway": "172.19.0.1"}], "wrong Production IPAM")
        require(not endpoint.get("NetworkID") or endpoint["NetworkID"] == network["Id"], "endpoint network identity mismatch")
        # Signed stopped rollback artifacts coexist with the active current
        # backend. Validate their endpoint shape without treating that current
        # owner as a conflict; network-state checks exclusivity before connection.
        network_state(item, network, check_conflicts=False, owner_items=owner_items)
    static = {
        "container_id": item["Id"], "revision": revision, "image_id": item["Image"],
        "environment_sha256": digest(("\n".join(sorted(entries)) + "\n").encode()),
        "host_config_sha256": digest(canonical(host)), "mounts": mounts,
        "mount_policy": mount_policy, "database": "mfms_server_prod",
        "environment": "Production", "network": "harvest-net", "production_ip": "172.19.0.2",
        "network_id": network["Id"] if network is not None else "hermetic-fixture",
        "restart_count": item["RestartCount"],
    }
    result = {"static": static, "running": item["State"]["Running"], "ip": ip}
    result["production_address_owners"] = ([identity for identity, owner in network["Containers"].items()
                                           if owner["IPv4Address"] == "172.19.0.2/16"] if network is not None else [])
    if host["OomKillDisable"] is None:
        # Docker 29 changes this explicit false to null on first start. Preserve
        # the raw signed hash, permitting only this observed one-field transition.
        created_host = dict(host, OomKillDisable=False)
        result["created_host_config_sha256"] = digest(canonical(created_host))
    return result


def source_fingerprint(item, image, network, owner_items, identity, image_id, revision):
    observed = snapshot(item, image, network, owner_items=owner_items)
    require(observed["static"]["container_id"] == identity
            and observed["static"]["image_id"] == image_id
            and observed["static"]["revision"] == revision, "preflight source identity mismatch")
    require(observed["running"] is True and observed["ip"] == "172.19.0.2"
            and observed["production_address_owners"] == [identity], "preflight source ownership mismatch")
    return digest(canonical({"validated": observed, "Config": item["Config"],
                             "HostConfig": item["HostConfig"],
                             "Mounts": sorted(item["Mounts"], key=canonical)}))


class Records:
    def __init__(self, state_dir, *, inspect=inspect_container):
        self.root = Path(state_dir)
        secure_path(self.root, directory=True, mode=0o700)
        if os.name != "nt":
            for parent in self.root.parents:
                info = parent.lstat()
                require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), "unsafe parent directory")
                require(info.st_uid in {0, os.getuid()} and not info.st_mode & 0o022, "unsafe parent ownership/permissions")
        self.directory = self.root / "backend-rollback-records"
        self.key_path = self.root / "backend-rollback-signing.key"
        self.state_path = self.root / "last-successful-backend-switch"
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
    def match_static(actual, expected):
        require(isinstance(expected.get("host_config_sha256"), str)
                and re.fullmatch(r"[0-9a-f]{64}", expected["host_config_sha256"]), "invalid recorded host configuration hash")
        observed = dict(actual["static"])
        if observed.get("host_config_sha256") != expected.get("host_config_sha256"):
            require(actual.get("created_host_config_sha256") == expected.get("host_config_sha256"),
                    "container host configuration drift")
            observed["host_config_sha256"] = expected["host_config_sha256"]
        require(observed == expected, "container/image/environment/configuration drift")

    @staticmethod
    def match(actual, expected, *, running):
        Records.match_static(actual, expected)
        require(actual["running"] == running, "container running state mismatch")
        require(actual["ip"] == ("172.19.0.2" if running else ""), "container network attachment mismatch")

    @staticmethod
    def match_source(actual, expected):
        observed, recorded = dict(actual["static"]), dict(expected)
        observed_restarts = observed.pop("restart_count")
        recorded_restarts = recorded.pop("restart_count")
        Records.match_static(dict(actual, static=observed), recorded)
        require(type(observed_restarts) is int and type(recorded_restarts) is int
                and observed_restarts >= recorded_restarts, "invalid source restart history")
        # Crash-loop counters and running state may change after the deployment
        # workflow exits. They must not disable restoration of the exact artifact.
        require(actual["ip"] in ({"172.19.0.2"} if actual["running"] else {"", "172.19.0.2"}), "source network attachment mismatch")

    def stage(self, identity, revision, image_id, target_name, run_id, timestamp, *, enrollment_hash=None):
        require(identity.startswith(f"{run_id}-{timestamp}-"), "deployment ID/run binding mismatch")
        state, state_hash = self.state()
        source = self.inspect("harvest-api")
        self.match(source, source["static"], running=True)
        require(state["deployed_revision"] == source["static"]["revision"] and state["deployed_image_id"] == source["static"]["image_id"], "live release differs from state")
        require(re.fullmatch(r"[0-9a-f]{40}", revision) and re.fullmatch(r"sha256:[0-9a-f]{64}", image_id), "invalid candidate")
        require(re.fullmatch(r"harvest-api-pre-[a-zA-Z0-9-]+", target_name), "invalid adjacent target name")
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
        current = self.inspect("harvest-api")
        target = self.inspect(preparation["target_name"])
        self.match(target, preparation["previous"], running=False)
        require(current["static"]["revision"] == preparation["revision"] and current["static"]["image_id"] == preparation["image_id"], "candidate differs from preparation")
        require(current["running"] == preparation["enrollment"], "candidate was activated before recording")
        committed = {
            "deployed_revision": preparation["revision"], "deployed_image_id": preparation["image_id"], "deployed_image_tag": image_tag,
            "rollback_container": preparation["target_name"], "rollback_revision": target["static"]["revision"],
            "rollback_image_id": target["static"]["image_id"], "rollback_image_tag": previous_image_tag,
            "run_id": preparation["run_id"], "updated_at": preparation["timestamp"], "database_migrations": "forward-only",
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
        self.match(self.inspect("harvest-api"), record["current"], running=True)
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
            self.match(self.inspect("harvest-api"), record["previous"], running=True)
            retained = self.inspect(receipt["retained_name"])
            self.match_source(retained, record["current"])
            require(not retained["running"] and not retained["ip"], "retained source is not detached/stopped")
            return {"status": "already-complete", "deployment_id": identity, "target": record["previous"], "target_name": "harvest-api"}
        require(state == record["committed_state"], "release state/record mismatch")
        self.match_source(self.inspect("harvest-api"), record["current"])
        self.match(self.inspect(record["target_name"]), record["previous"], running=False)
        return {"status": "ready", "deployment_id": identity, "target": record["previous"], "target_name": record["target_name"]}

    def rollback_receipt(self, identity, receipt_id, retained_name, run_id, timestamp):
        record, _ = self.deployment(identity)
        require(self.state()[0] == record["committed_state"], "rollback source state changed")
        self.match(self.inspect("harvest-api"), record["previous"], running=True)
        retained = self.inspect(retained_name)
        self.match_source(retained, record["current"])
        require(not retained["running"] and not retained["ip"], "retained source is not detached/stopped")
        previous_state = record["committed_state"]
        committed = {
            "deployed_revision": record["previous"]["revision"], "deployed_image_id": record["previous"]["image_id"], "deployed_image_tag": previous_state["rollback_image_tag"],
            "rollback_container": retained_name, "rollback_revision": record["current"]["revision"], "rollback_image_id": record["current"]["image_id"],
            "rollback_image_tag": previous_state["deployed_image_tag"], "run_id": run_id, "updated_at": timestamp,
            "database_migrations": "forward-only", "rollback_record_id": identity, "rollback_receipt_id": receipt_id,
        }
        self.save(receipt_id, "rollback", {
            "kind": "rollback", "deployment_id": receipt_id, "source_deployment_id": identity,
            "deployment_sha256": digest(canonical(record)), "retained_name": retained_name, "committed_state": committed,
        })
        atomic_write(self.state_path, state_bytes(committed))

    def restored(self, identity, operation):
        if operation == "rollback":
            record, _ = self.deployment(identity)
            source = self.inspect("harvest-api")
            self.match_source(source, record["current"])
            require(source["running"], "restored source is not running")
            require(self.state()[0] == record["committed_state"], "rollback recovery state mismatch")
        else:
            require(operation in {"deploy", "credential-cutover"}, "invalid recovery operation")
            preparation = self.load(identity, "prepare")
            source = self.inspect("harvest-api")
            self.match_source(source, preparation["previous"])
            require(source["running"] is True and source["ip"] == "172.19.0.2",
                    "restored source lifecycle mismatch")
            require(self.state()[1] == preparation["source_state_sha256"], "deployment recovery state mismatch")

    def restore_ready(self, identity, operation, container):
        if operation == "rollback":
            record, _ = self.deployment(identity)
            expected = record["current"]
            permitted_owners = {record["current"]["container_id"], record["previous"]["container_id"]}
            require(self.state()[0] == record["committed_state"], "rollback recovery state mismatch")
        else:
            require(operation in {"deploy", "credential-cutover"}, "invalid recovery operation")
            preparation = self.load(identity, "prepare")
            expected = preparation["previous"]
            permitted_owners = {expected["container_id"]}
            deployment_path = self.path(identity, "deployment")
            if deployment_path.exists() or deployment_path.is_symlink():
                record, _ = self.deployment(identity)
                permitted_owners.add(record["current"]["container_id"])
            require(self.state()[1] == preparation["source_state_sha256"], "deployment recovery state mismatch")
        source = self.inspect(container)
        self.match_source(source, expected)
        self.match_owners(source, permitted_owners)
        require(type(source["running"]) is bool and source["ip"] == ("172.19.0.2" if source["running"] else ""),
                "unverified restoration source lifecycle")

    def prepare_only_replacement(self, identity, operation, container):
        require(operation in {"deploy", "credential-cutover"}, "invalid prepare-only recovery operation")
        require(container == "harvest-api", "invalid prepare-only replacement name")
        deployment_path = self.path(identity, "deployment")
        require(not deployment_path.exists() and not deployment_path.is_symlink(),
                "deployment record exists for replacement")
        preparation = self.load(identity, "prepare")
        require(self.state()[1] == preparation["source_state_sha256"],
                "deployment recovery state mismatch")
        source = self.inspect(container)
        expected_source = preparation["previous"]
        observed = source["static"]
        require(observed["container_id"] != expected_source["container_id"],
                "prepare-only replacement aliases source")
        require(observed["revision"] == preparation["revision"]
                and observed["image_id"] == preparation["image_id"],
                "prepare-only replacement identity mismatch")
        require(all(observed[key] == expected_source[key] for key in
                    ("database", "environment", "network", "production_ip", "network_id")),
                "prepare-only replacement Production contract mismatch")
        require(type(observed["restart_count"]) is int and observed["restart_count"] == 0,
                "prepare-only replacement has lifecycle history")
        self.match_owners(source, {expected_source["container_id"], observed["container_id"]})
        require(source["running"] is False and source["ip"] == "",
                "prepare-only replacement lifecycle mismatch")
        return source

    def replacement_ready(self, identity, operation, container):
        if operation == "rollback":
            record, preparation = self.deployment(identity)
            expected = record["previous"]
            require(self.state()[0] == record["committed_state"], "rollback recovery state mismatch")
        else:
            require(operation in {"deploy", "credential-cutover"}, "invalid recovery operation")
            deployment_path = self.path(identity, "deployment")
            if not deployment_path.exists() and not deployment_path.is_symlink():
                return self.prepare_only_replacement(identity, operation, container)["static"]["container_id"]
            record, preparation = self.deployment(identity)
            expected = record["current"]
            require(self.state()[1] == preparation["source_state_sha256"], "deployment recovery state mismatch")
        source = self.inspect(container)
        self.match_static(source, expected)
        self.match_owners(source, {record["current"]["container_id"], record["previous"]["container_id"]})
        return source["static"]["container_id"]

    @staticmethod
    def match_owners(observed, permitted):
        owners = observed["production_address_owners"]
        require(isinstance(owners, list) and len(owners) <= 1
                and all(isinstance(value, str) and value in permitted for value in owners),
                "unrelated or duplicate Production address owner")
        require(type(observed["running"]) is bool, "invalid owner phase lifecycle")
        if observed["running"]:
            require(owners == [observed["static"]["container_id"]], "running artifact does not own Production address")
        else:
            require(observed["static"]["container_id"] not in owners, "stopped artifact claims active Production address")

    def transition_ready(self, identity, operation, role, container, running):
        require(role in {"source", "target"} and running in {"true", "false"}, "invalid transition phase")
        observed = None
        if operation == "rollback":
            record, _ = self.deployment(identity)
            expected = record["current" if role == "source" else "previous"]
            require(self.state()[0] == record["committed_state"], "rollback transition state mismatch")
        else:
            require(operation in {"deploy", "credential-cutover"}, "invalid transition operation")
            preparation = self.load(identity, "prepare")
            require(self.state()[1] == preparation["source_state_sha256"], "deployment transition state mismatch")
            if role == "source":
                expected = preparation["previous"]
            else:
                deployment_path = self.path(identity, "deployment")
                if not deployment_path.exists() and not deployment_path.is_symlink():
                    observed = self.prepare_only_replacement(identity, operation, container)
                    expected = observed["static"]
                else:
                    expected = self.deployment(identity)[0]["current"]
        observed = self.inspect(container) if observed is None else observed
        self.match_source(observed, expected) if role == "source" else self.match_static(observed, expected)
        expected_running = running == "true"
        require(observed["running"] is expected_running
                and observed["ip"] == ("172.19.0.2" if expected_running else ""), "transition lifecycle mismatch")
        require(observed["production_address_owners"] == ([expected["container_id"]] if expected_running else []),
                "transition Production address ownership mismatch")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("operation", choices=["initialize", "stage", "finalize", "activate", "verify", "receipt", "restored", "restore-ready", "replacement-ready", "transition-ready", "network-state", "source-fingerprint"])
    parser.add_argument("values", nargs="*")
    args = parser.parse_args()
    if args.operation == "source-fingerprint":
        require(len(args.values) == 4, "invalid source fingerprint arguments")
        name, identity, image_id, revision = args.values
        item, image, network, owner_items = inspect_artifact(name)
        print(source_fingerprint(item, image, network, owner_items, identity, image_id, revision))
        return
    if args.operation == "network-state":
        require(len(args.values) == 2 and args.values[1] in {"attached", "running", "ip", "static_ip"}, "invalid network query")
        item, image, network, owner_items = inspect_artifact(args.values[0])
        snapshot(item, image, network, owner_items=owner_items)
        value = network_state(item, network, owner_items=owner_items)[args.values[1]]
        print(str(value).lower() if type(value) is bool else value)
        return
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
    elif args.operation == "restore-ready":
        records.restore_ready(*args.values)
    elif args.operation == "replacement-ready":
        print(records.replacement_ready(*args.values))
    elif args.operation == "transition-ready":
        records.transition_ready(*args.values)


if __name__ == "__main__":
    try:
        main()
    except (Refused, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        raise SystemExit("PRODUCTION_BACKEND_ROLLBACK_RECORD=BLOCKED (record, artifact or configuration validation failed)")
