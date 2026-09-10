#!/usr/bin/env python3
"""Explicitly invoked, disposable-only Docker lifecycle evidence (never deploys)."""
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import urllib.request
from docker_inspect_evidence import Evidence, stable, sha

NAME = "mfms-controller-repair-test-20260909-lifecycle"
NETWORK = NAME + "-net"
LABEL = "com.muthufarms.controller-repair-test"
IMAGE = "sha256:7537c55757bb0ed565d7bd95e71a19292596802fbdc614d4196f8a3f565e033d"
PRODUCTION = "05fb88f88251cc79954f9212b07e6484c71c15c6e21da74445122292f5d0c4fe"
REVISION = "f31bd87a8ab12fa9f2c5cd3ef1de1fd89071746c"
SUBNET = "172.30.240.0/24"
POOL = "172.30.240.128/25"
ADDRESS = "172.30.240.2"
AUDIT = None
BEFORE = None


def require(value, message):
    if not value:
        raise RuntimeError(message)


def docker(*args):
    result = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=60)
    if AUDIT is not None and "inspect" in args[:2]:
        AUDIT.inspection(result.stdout)
    require(result.returncode == 0, "Docker operation failed: " + args[0])
    return result.stdout.strip()


def inspect_container(identity):
    return json.loads(docker("inspect", identity))[0]


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def inventory():
    ids = docker("ps", "-aq", "--no-trunc").splitlines()
    require(all(re.fullmatch(r"[0-9a-f]{64}", identity) for identity in ids), "Noncanonical container ID")
    items = json.loads(docker("inspect", *ids)) if ids else []
    require({item["Id"] for item in items} == set(ids), "Incomplete inventory")
    return {item["Id"]: item for item in items}


def protected(items):
    return {identity: sha(stable(item)) for identity, item in items.items()}


def production_health():
    item = inspect_container(PRODUCTION)
    require(item["Image"] == IMAGE and item["State"]["Running"], "Production identity/health changed")
    with urllib.request.urlopen("http://127.0.0.1:8001/health", timeout=10) as response:
        require(response.status == 200 and json.load(response).get("status") == "ok", "Production health failed")
    with urllib.request.urlopen("http://127.0.0.1:8001/api/backend-version", timeout=10) as response:
        version = json.load(response)
    require(version.get("git_commit") == REVISION and version.get("runtime_environment") == "production"
            and version.get("target_database") == "mfms_server_prod", "Production revision changed")


def owned_container(identity, network_id):
    item = inspect_container(identity)
    require(item["Id"] == identity and item["Name"] == "/" + NAME and item["Image"] == IMAGE, "Test identity mismatch")
    require(item["Config"]["Labels"].get(LABEL) == NAME, "Test ownership mismatch")
    require(item["Config"]["Labels"].get("com.muthufarms.mfms.environment") == "DisposableTest"
            and item["Config"]["Entrypoint"] == ["python"]
            and item["Config"]["Cmd"] == ["-c", "import time; time.sleep(900)"], "Test command mismatch")
    host = item["HostConfig"]
    require(host["NetworkMode"] == network_id and host["RestartPolicy"]["Name"] == "no"
            and not host.get("Privileged") and not host.get("PublishAllPorts")
            and not host.get("Devices") and not host.get("DeviceRequests") and not host.get("Mounts")
            and host.get("PidMode", "") == "" and host.get("IpcMode") == "private"
            and host.get("UTSMode", "") == "", "Unsafe test runtime")
    require(not item["Mounts"] and not item["HostConfig"].get("Binds")
            and not item["HostConfig"].get("PortBindings"), "Test has forbidden mounts/ports")
    require(set(item["NetworkSettings"]["Networks"]) == {NETWORK}, "Test network mismatch")
    endpoint = item["NetworkSettings"]["Networks"][NETWORK]
    require(endpoint.get("NetworkID") in ("", network_id), "Test network identity mismatch")
    return item


def evidence(item):
    return {"Id": item["Id"], "Image": item["Image"], "HostConfig": item["HostConfig"],
            "State": item["State"], "RestartCount": item["RestartCount"],
            "NetworkSettings": item["NetworkSettings"], "ConfigSha256": digest(item["Config"])}


def main():
    global AUDIT, BEFORE
    AUDIT = Evidence(Path.home() / ".local/state/mfms-controller-repair-tests")
    print("PRIVATE_EVIDENCE_DIRECTORY=" + str(AUDIT.root), flush=True)
    before = inventory()
    BEFORE = before
    AUDIT.snapshot("before", before)
    production_health()
    require(all(item["Name"] != "/" + NAME for item in before.values()), "Test name already exists")
    image = json.loads(docker("image", "inspect", IMAGE))[0]
    require(image["Id"] == IMAGE and not image["Config"].get("Volumes"), "Unexpected image/volumes")
    permitted_env = {"PATH", "LANG", "GPG_KEY", "PYTHON_VERSION", "PYTHON_SHA256", "PYTHONDONTWRITEBYTECODE",
                     "PYTHONUNBUFFERED", "MFMS_GIT_COMMIT", "MFMS_BUILD_TIMESTAMP", "MFMS_BUILD_ENVIRONMENT",
                     "MFMS_FERTILISER_WRITES_ENABLED"}
    require(all(entry.split("=", 1)[0] in permitted_env for entry in image["Config"].get("Env") or []),
            "Unexpected inherited image environment")
    networks = [json.loads(line) for line in docker("network", "ls", "--format", "json").splitlines()]
    for entry in networks:
        require(entry["Name"] != NETWORK, "Test network already exists")
        existing = json.loads(docker("network", "inspect", entry["ID"]))[0]
        for config in existing.get("IPAM", {}).get("Config") or []:
            subnet = config.get("Subnet")
            if subnet and ipaddress.ip_network(subnet).version == 4:
                require(not ipaddress.ip_network(SUBNET).overlaps(ipaddress.ip_network(subnet)), "Test subnet overlaps")
    network_id = None
    container_id = None
    network_attempted = False
    container_attempted = False
    records = {}
    try:
        network_attempted = True
        network_id = docker("network", "create", "--internal", "--driver", "bridge", "--subnet", SUBNET,
                            "--ip-range", POOL, "--gateway", "172.30.240.1", "--label", LABEL + "=" + NAME, NETWORK)
        network = json.loads(docker("network", "inspect", network_id))[0]
        require(network["Id"] == network_id and network["Name"] == NETWORK and network["Internal"]
                and network["Driver"] == "bridge" and network["Labels"].get(LABEL) == NAME
                and network["IPAM"]["Config"] == [{"Subnet": SUBNET, "IPRange": POOL, "Gateway": "172.30.240.1"}]
                and not network["Containers"], "Unsafe test network")
        container_attempted = True
        container_id = docker("create", "--pull", "never", "--name", NAME, "--label", LABEL + "=" + NAME,
                              "--label", "com.muthufarms.mfms.environment=DisposableTest", "--network", network_id,
                              "--ip", ADDRESS, "--restart", "no", "--memory", "128m", "--pids-limit", "32",
                              "--cpus", "0.25", "--entrypoint", "python", IMAGE,
                              "-c", "import time; time.sleep(900)")
        require(re.fullmatch(r"[0-9a-f]{64}", container_id), "Noncanonical test identity")
        for phase, operation in (("created", None), ("running", "start"), ("stopped", "stop"), ("restarted", "start")):
            if operation:
                owned_container(container_id, network_id)
                docker(operation, container_id)
            item = owned_container(container_id, network_id)
            AUDIT.snapshot(phase, {container_id: item})
            records[phase] = evidence(item)
            records[phase]["OldFormatterIp"] = docker("inspect", "--format", '{{with index .NetworkSettings.Networks "' + NETWORK + '"}}{{.IPAddress}}{{end}}', container_id)
            AUDIT.write(phase + ".lifecycle.json", records[phase])
            require(item["State"]["Running"] == (phase in ("running", "restarted")), "Unexpected fixture lifecycle")
        records["HostConfigChangedKeys"] = [key for key in set(records["created"]["HostConfig"]) | set(records["running"]["HostConfig"])
                                             if records["created"]["HostConfig"].get(key) != records["running"]["HostConfig"].get(key)]
    finally:
        AUDIT.write("lifecycle-records.json", records)
        # Retain the complete observations even if cleanup or an assertion fails.
        observed = inventory()
        AUDIT.snapshot("before-cleanup", observed)
        # A successful daemon mutation can outlive a lost CLI response. Reconcile only
        # the exact absent-before names, then enforce full ownership before cleanup.
        if container_attempted and container_id is None:
            matches = [item for item in inventory().values() if item["Name"] == "/" + NAME]
            require(len(matches) <= 1, "Ambiguous test container")
            if matches:
                container_id = matches[0]["Id"]
        if network_attempted and network_id is None:
            matches = [json.loads(line) for line in docker("network", "ls", "--format", "json").splitlines()
                       if json.loads(line)["Name"] == NETWORK]
            require(len(matches) <= 1, "Ambiguous test network")
            if matches:
                network_id = json.loads(docker("network", "inspect", matches[0]["ID"]))[0]["Id"]
        if container_id:
            owned_container(container_id, network_id)
            docker("rm", "-f", container_id)
        if network_id:
            network = json.loads(docker("network", "inspect", network_id))[0]
            require(network["Id"] == network_id and network["Name"] == NETWORK
                    and network["Labels"].get(LABEL) == NAME and network["Internal"] and network["Driver"] == "bridge"
                    and network["IPAM"]["Config"] == [{"Subnet": SUBNET, "IPRange": POOL, "Gateway": "172.30.240.1"}]
                    and not network["Containers"], "Unsafe network cleanup")
            docker("network", "rm", network_id)
        after = inventory()
        AUDIT.snapshot("after", after)
        summary = AUDIT.comparison(before, after)
        print("PROTECTED_EVIDENCE_SUMMARY=" + json.dumps(summary, sort_keys=True), flush=True)
        require(summary["protected_changes"] == 0, "Protected containers changed; private evidence retained")
        production_health()
    # No raw inspect, arguments, environment values or diff values leave the host.
    print("DISPOSABLE_LIFECYCLE_STATUS=PASS", flush=True)


if __name__ == "__main__":
    try:
        main()
    except BaseException as failure:
        # Read-only final capture also runs when cleanup or a preflight assertion
        # fails. Never print exception data or protected diff values.
        if AUDIT is not None:
            try:
                AUDIT.failure("primary-failure", failure)
            except BaseException:
                print("FAILURE_DETAIL_CAPTURE_FAILED=prior_private_evidence_retained", flush=True)
            try:
                failed = inventory()
                AUDIT.snapshot("failure", failed)
                if BEFORE is not None:
                    summary = AUDIT.comparison(BEFORE, failed, "failure-comparison")
                    print("FAILURE_EVIDENCE_SUMMARY=" + json.dumps(summary, sort_keys=True), flush=True)
            except BaseException as closure_failure:
                try:
                    AUDIT.failure("closure-failure", closure_failure)
                except BaseException:
                    pass
                print("FINAL_EVIDENCE_CAPTURE_FAILED=prior_private_evidence_retained", flush=True)
        print("DISPOSABLE_LIFECYCLE_STATUS=FAILED", flush=True)
        raise SystemExit(1) from None
