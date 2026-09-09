#!/usr/bin/env python3
"""Single reviewed Preview coconut audit hotfix. No generic deployment interface."""
import copy
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import pwd
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl, quote
from urllib.request import urlopen

BASE = "0f8f8a0f7482f99f7826f9baf4b7afcc630f0c99"
BASE_IMAGE = "sha256:eb261fb23f71bb0ac96aeee5d6af16201cbcc8eb5050c7bb7d277ebb62fa54fe"
CANDIDATE = "c5d8e4855be5c4ca76b14d278c04a16a7f311ac4"
BRANCH = "hotfix/coconut-bunch-tying-live-0f8f8a0"
FILES = {"api/app/routers/coconut_bunch_tying.py": "21b381d8d5ca6c1e75107640aa455812dab4562d7113717ba8e00a188ab7974c", "tests/test_coconut_bunch_tying_postgres.py": "07bc759d9afc1b97253ffcefd333617e547d37caf79893e35da43e91977f0408"}
BASE_ENV_HASH = "a33cccdce65971936377062860d03e6b107a5b1a14f14e5dd27dd6421ebb623f"
LEDGER_HASH = "feb2200f59053e00c7b47569599e1d9ab8942f4f92536ab120cbfaedac74deb0"
ORIGINAL = Path("/home/muthu/.local/libexec/mfms-preview-backend-deploy")
ORIGINAL_HASH = "2b01aaf661f4a0f1031d34ac79df6d894d1288773d2cacbf12000fd7a4243b32"
NAME = "harvest-api-pilot"
NETWORK = "harvest-net"
NETWORK_ID = "6327f4a8da1cd862d74776049e808fbd4cd1a2125055d73f7db42382a368005f"
IP = "172.19.128.1"
DB = "mfms_server_uat"
REPO = "git@github.com-mfms-preview-backend:ayemuthu1963-beep/muthu-harvest-dashboard.git"
STATE = Path("/home/muthu/.local/state/mfms-preview-github")
MOUNTS = {
    "/var/lib/mfms/ai-control": ("/home/muthu/.local/state/mfms-preview-ai-control", True),
    "/run/secrets/mfms_intelligence_preview_key": ("/home/muthu/.local/state/mfms-preview-intelligence/preview_service_key", False),
    "/var/lib/mfms/motor-screenshot-analysis": ("/home/muthu/mfms_data/preview/motor-screenshot-analysis", True),
    "/host-tmp": ("/tmp", True),
}
PATHS = {
    "/api/coconut-bunch-tying/import/apply": ["post"],
    "/api/coconut-bunch-tying/import/validate": ["post"],
    "/api/coconut-bunch-tying/observations/{observation_id}": ["patch"],
    "/api/coconut-bunch-tying/rounds": ["get"],
    "/api/coconut-bunch-tying/rounds/{round_id}/coverage": ["get"],
    "/api/coconut-bunch-tying/rounds/{round_id}/reverse": ["post"],
    "/api/coconut-bunch-tying/rounds/{round_id}/source": ["get"],
    "/api/coconut-bunch-tying/template": ["get"],
}


class Blocked(RuntimeError):
    pass


def require(condition, reason):
    if not condition:
        raise Blocked(reason)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def sanitize_build_output(value):
    text = value.decode("utf-8", errors="replace")
    text = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", text)
    text = "".join(character for character in text if character in "\n\t" or ord(character) >= 32)
    text = re.sub(r"(https?://)[^\s/@]+@", r"\1[REDACTED]@", text, flags=re.IGNORECASE)
    text = re.sub(r"(?im)(authorization\s*:\s*).*", r"\1[REDACTED]", text)
    return re.sub(r"(?i)((?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+", r"\1[REDACTED]", text)


def retain_build_evidence(result):
    # This receives public-source build output only, never container exec output.
    directory = STATE / "coconut-build-evidence"
    directory.mkdir(mode=0o700, exist_ok=True)
    require(not directory.is_symlink() and directory.stat().st_uid == os.getuid()
            and directory.stat().st_mode & 0o777 == 0o700, "build evidence directory must be private")
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix=CANDIDATE + "-", suffix=".log", dir=directory, delete=False) as output:
        os.fchmod(output.fileno(), 0o600)
        output.write("stage=docker build\nexit_code=" + str(result.returncode) + "\nstdout:\n")
        output.write(sanitize_build_output(result.stdout))
        output.write("\nstderr:\n")
        output.write(sanitize_build_output(result.stderr))
        output.flush()
        os.fsync(output.fileno())
        return output.name


def command(*args, data=None, retain_build=False):
    require(not retain_build or args[:2] == ("docker", "build"), "evidence logging is restricted to docker build")
    environment = os.environ.copy()
    environment["GIT_TERMINAL_PROMPT"] = "0"
    environment["GIT_SSH_COMMAND"] = "ssh -o BatchMode=yes -o ConnectTimeout=15"
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment)
    stage = "docker " + args[1] if args[:2] in {("docker", "build"), ("docker", "exec")} else args[0]
    evidence = retain_build_evidence(result) if retain_build else None
    suffix = " evidence=" + evidence if evidence else ""
    require(result.returncode == 0, "command failed: " + stage + " exit_code=" + str(result.returncode) + suffix)
    if evidence:
        print("PREVIEW_COCONUT_BUILD_EVIDENCE=" + evidence)
    return result.stdout


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(120)
        self.sock.connect("/var/run/docker.sock")


def docker(method, path, payload=None):
    conn = DockerConnection("localhost", timeout=120)
    try:
        conn.request(method, "/v1.47" + path,
                     body=None if payload is None else canonical(payload),
                     headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        body = response.read()
        require(200 <= response.status < 300, "Docker operation failed: " + method + " " + path.split("?")[0])
        return json.loads(body) if body else None
    finally:
        conn.close()


def inspect(name=NAME):
    return docker("GET", "/containers/" + name + "/json")


def original_unchanged():
    require(ORIGINAL.is_file() and not ORIGINAL.is_symlink(), "original controller identity")
    require(digest(ORIGINAL.read_bytes()) == ORIGINAL_HASH, "original controller checksum changed")


def validate_tree(repo, branch, revision):
    require(branch == BRANCH and revision == CANDIDATE, "candidate branch or commit mismatch")
    require(command("git", "-C", str(repo), "rev-parse", "HEAD").decode().strip() == CANDIDATE, "checkout mismatch")
    require(command("git", "-C", str(repo), "rev-parse", CANDIDATE + "^").decode().strip() == BASE, "candidate parent mismatch")
    changed = command("git", "-C", str(repo), "diff", "--name-only", "-z", BASE, CANDIDATE).decode().split("\0")[:-1]
    require(set(changed) == set(FILES), "extra or missing changed files")
    require(not command("git", "-C", str(repo), "diff", "--raw", BASE, CANDIDATE, "--", "db"), "migration tree differs")
    require(not command("git", "-C", str(repo), "status", "--porcelain", "--untracked-files=all"), "checkout dirty")
    for path, expected in FILES.items():
        entry = command("git", "-C", str(repo), "ls-tree", CANDIDATE, "--", path).decode()
        require(entry.startswith("100644 blob "), "candidate file mode mismatch")
        require(digest(command("git", "-C", str(repo), "show", CANDIDATE + ":" + path)) == expected, "reviewed file hash mismatch")


def validate_live(live, revision=BASE, image=BASE_IMAGE):
    require(live["Name"] == "/" + NAME and live["State"]["Running"], "not the running Preview container")
    require(live["Image"] == image, "live image mismatch")
    cfg, host = live["Config"], live["HostConfig"]
    env = dict(item.split("=", 1) for item in cfg["Env"])
    require(env.get("MFMS_GIT_COMMIT") == revision, "live revision mismatch or replay")
    require(env.get("MFMS_ENV", "").lower() == "preview" and env.get("MFMS_BUILD_ENVIRONMENT") == "Preview", "Production/environment target rejected")
    require(env.get("MFMS_TARGET_DATABASE") == DB, "database environment target rejected")
    validate_database_url(env["DATABASE_URL"])
    if revision == BASE:
        require(digest(canonical(cfg["Env"])) == BASE_ENV_HASH, "pinned baseline environment changed")
    require(cfg["Labels"].get("org.opencontainers.image.revision") == revision, "image revision label mismatch")
    require(cfg["Labels"].get("com.muthufarms.mfms.environment") == "Preview", "image environment mismatch")
    require(host["NetworkMode"] == NETWORK and set(live["NetworkSettings"]["Networks"]) == {NETWORK}, "network target mismatch")
    net = live["NetworkSettings"]["Networks"][NETWORK]
    require(net["NetworkID"] == NETWORK_ID and net["IPAddress"] == IP, "network identity or IP mismatch")
    require(host["PortBindings"] == {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8015"}]}, "port target mismatch")
    require(host["RestartPolicy"] == {"Name": "no", "MaximumRetryCount": 0}, "restart policy mismatch")
    require(not host["Privileged"] and host["PidMode"] == "" and host["IpcMode"] == "private", "unsafe runtime privileges")
    require(not host.get("Binds") and len(host.get("Mounts", [])) == 4, "unsupported mount configuration")
    require({m["Destination"]: (m["Source"], m["RW"]) for m in live["Mounts"]} == MOUNTS, "mount contract mismatch")
    require(all(m["Type"] == "bind" for m in live["Mounts"]), "mount type mismatch")


def validate_database_url(value):
    target = urlsplit(value)
    require(target.scheme in {"postgres", "postgresql"} and target.hostname == "harvest-db"
            and target.port in {None, 5432} and target.username == "mfms_uat_app"
            and target.path == "/" + DB and not target.query and not target.fragment,
            "Production or alternate database connection rejected")


# Executed in the inspected API container; every database statement is read-only.
DATABASE_PROBE = r'''
import hashlib,json
from urllib.parse import urlsplit
import psycopg
from psycopg.rows import dict_row
from app.config import get_settings
settings=get_settings()
target=urlsplit(settings.database_url)
if target.path != '/mfms_server_uat' or target.hostname != 'harvest-db' or target.username != 'mfms_uat_app':
 raise RuntimeError('database target rejected')
with psycopg.connect(settings.database_url,row_factory=dict_row) as conn:
 conn.execute('BEGIN READ ONLY')
 identity=conn.execute("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro").fetchone()
 if identity != {'db':'mfms_server_uat','role':'mfms_uat_app','ro':'on'}:
  raise RuntimeError('database identity rejected')
 rows=conn.execute('SELECT * FROM mfms_preview_schema_migrations ORDER BY migration_name').fetchall()
 ledger={row['migration_name']:row['sha256'] for row in rows}
 counts={}
 for table in ['coconut_bunch_tying_rounds','coconut_bunch_tying_observations','coconut_bunch_tying_audit']:
  counts[table]=conn.execute('SELECT count(*) AS n FROM '+table).fetchone()['n']
 counts['2026-H2']=conn.execute("SELECT count(*) AS n FROM coconut_bunch_tying_rounds WHERE round_code='2026-H2'").fetchone()['n']
 counts['orphan_observations']=conn.execute('SELECT count(*) AS n FROM coconut_bunch_tying_observations o LEFT JOIN coconut_bunch_tying_rounds r USING(round_id) WHERE r.round_id IS NULL').fetchone()['n']
 counts['orphan_audits']=conn.execute('SELECT count(*) AS n FROM coconut_bunch_tying_audit a LEFT JOIN coconut_bunch_tying_rounds r USING(round_id) LEFT JOIN coconut_bunch_tying_observations o USING(observation_id) WHERE r.round_id IS NULL OR (a.observation_id IS NOT NULL AND o.observation_id IS NULL)').fetchone()['n']
 print(json.dumps({'identity':identity,'rows':rows,'count':len(rows),'hash':hashlib.sha256(json.dumps(ledger,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'counts':counts},default=str))
 conn.rollback()
'''


def validate_ledger(probe, previous=None):
    require(probe["identity"] == {"db": DB, "role": "mfms_uat_app", "ro": "on"}, "database identity mismatch")
    require(probe["count"] == 23 and probe["hash"] == LEDGER_HASH, "migration ledger mismatch")
    require(all(value == 0 for value in probe["counts"].values()) and len(probe["counts"]) == 6, "tying records or incomplete rollback")
    if previous is not None:
        require(probe == previous, "full ledger or database snapshot changed")


def database_probe(name, previous=None):
    result = json.loads(command("docker", "exec", "-i", name, "python", "-", data=DATABASE_PROBE.encode()))
    validate_ledger(result, previous)
    return result


def health(port, revision):
    last = None
    for _ in range(30):
        try:
            def get(path):
                with urlopen("http://127.0.0.1:" + str(port) + path, timeout=5) as response:
                    require(response.status == 200, "health HTTP status")
                    return json.load(response)
            require(get("/health").get("status") == "ok", "health body")
            version = get("/api/backend-version")
            require(version.get("git_commit") == revision and version.get("environment") == "Preview", "backend revision")
            require(version.get("runtime_environment") == "preview" and version.get("target_database") == DB, "backend runtime target")
            paths = get("/openapi.json")["paths"]
            actual = {p: sorted(paths[p]) for p in paths if p.startswith("/api/coconut-bunch-tying/")}
            require(actual == PATHS, "eight tying endpoints changed")
            return
        except Exception as exc:
            last = type(exc).__name__
            time.sleep(1)
    raise Blocked("health/version/endpoints failed: " + str(last))


def protected(exclude):
    entries = docker("GET", "/containers/json?all=1")
    return {c["Id"]: digest(canonical({k: c[k] for k in ("Id", "Names", "ImageID", "State", "Ports")})) for c in entries if c["Id"] not in exclude}


def create_payload(live, image, revision, shadow=False, timestamp=None):
    config = copy.deepcopy(live["Config"])
    host = copy.deepcopy(live["HostConfig"])
    config["Image"] = image
    config["Hostname"] = ""
    config["Labels"]["org.opencontainers.image.revision"] = revision
    if timestamp:
        config["Labels"]["org.opencontainers.image.created"] = timestamp
    env = dict(item.split("=", 1) for item in config["Env"])
    env["MFMS_GIT_COMMIT"] = revision
    if timestamp:
        env["MFMS_BUILD_TIMESTAMP"] = timestamp
    if shadow:
        parts = urlsplit(env["DATABASE_URL"])
        query = dict(parse_qsl(parts.query))
        query["options"] = "-c default_transaction_read_only=on"
        env["DATABASE_URL"] = urlunsplit(parts._replace(query=urlencode(query, quote_via=quote)))
        for mount in host["Mounts"]:
            mount["ReadOnly"] = True
        host["PortBindings"]["8000/tcp"][0]["HostPort"] = "8016"
    config["Env"] = [key + "=" + value for key, value in env.items()]
    endpoint = {} if shadow else {"IPAMConfig": {"IPv4Address": IP}}
    return {**config, "HostConfig": host, "NetworkingConfig": {"EndpointsConfig": {NETWORK: endpoint}}}


def validate_shadow(shadow, image):
    require(shadow["Image"] == image and shadow["State"]["Running"], "shadow immutable identity")
    require(set(shadow["NetworkSettings"]["Networks"]) == {NETWORK}
            and shadow["NetworkSettings"]["Networks"][NETWORK]["NetworkID"] == NETWORK_ID, "shadow network identity")
    require(shadow["HostConfig"]["PortBindings"] == {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8016"}]}, "shadow loopback port")
    require({m["Destination"]: (m["Source"], m["RW"]) for m in shadow["Mounts"]}
            == {target: (source, False) for target, (source, _) in MOUNTS.items()}, "shadow mounts must be read-only")
    environment = dict(value.split("=", 1) for value in shadow["Config"]["Env"])
    require(dict(parse_qsl(urlsplit(environment["DATABASE_URL"]).query)) == {"options": "-c default_transaction_read_only=on"}, "shadow database must default read-only")


def cleanup_shadow(name, image):
    if image is None:
        return
    for row in docker("GET", "/containers/json?all=1"):
        if "/" + name in row["Names"]:
            require(row["ImageID"] == image, "shadow cleanup refuses unowned image")
            docker("DELETE", "/containers/" + row["Id"] + "?force=1")


def image_sources(repo, container, revision):
    entries = command("git", "-C", str(repo), "ls-tree", "-r", "--name-only", revision).decode().splitlines()
    expected = {}
    for path in entries:
        target = None
        for source, destination in (("api/app/", "/app/app/"), ("scripts/", "/app/scripts/"), ("db/migrations/", "/app/migrations/"), ("db/rollbacks/", "/app/rollbacks/")):
            if path.startswith(source):
                target = destination + path[len(source):]
        if path == "api/requirements.txt":
            target = "/app/requirements.txt"
        if path == "tests/irrigation_pipeline_fixture.json":
            target = "/app/data/irrigation-pipeline/kobo-irrigation-pipeline-survey-2026-06.json"
        if target:
            content = command("git", "-C", str(repo), "show", revision + ":" + path)
            if path.startswith("scripts/") and path.endswith(".sh"):
                content = content.replace(b"\r\n", b"\n")
            expected[target] = digest(content)
    script = "import hashlib; from pathlib import Path; expected=" + repr(expected) + ";\nactual={str(p) for root in ['/app/app','/app/scripts','/app/migrations','/app/rollbacks'] for p in Path(root).rglob('*') if p.is_file() and '__pycache__' not in p.parts}; actual.update(['/app/requirements.txt','/app/data/irrigation-pipeline/kobo-irrigation-pipeline-survey-2026-06.json'])\nif actual != set(expected) or not all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in expected.items()): raise RuntimeError('source identity mismatch')\nprint(len(expected))"
    command("docker", "exec", "-i", container, "python", "-", data=script.encode())


def main():
    require(len(sys.argv) == 2 and sys.argv[1] == "DEPLOY PREVIEW COCONUT " + CANDIDATE, "exact candidate confirmation required")
    require(os.getuid() != 0 and pwd.getpwuid(os.getuid()).pw_name == "muthu", "only muthu may run")
    require("168.144.179.221" in command("hostname", "-I").decode().split(), "Preview host mismatch")
    require(len(CANDIDATE) == 40 and all(len(h) == 64 for h in FILES.values()), "unreviewed controller pins")
    original_unchanged()
    os.umask(0o077)
    require(STATE.is_dir() and not STATE.is_symlink(), "deployment state directory missing")
    with (STATE / "deployment.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy()


def deploy():
    live = inspect()
    validate_live(live)
    ledger = database_probe(NAME)
    health(8015, BASE)
    before = protected({live["Id"]})
    shadow_name = NAME + "-coconut-shadow-" + CANDIDATE[:12]
    rollback_name = NAME + "-coconut-rollback-" + BASE[:12]
    names = {name for row in docker("GET", "/containers/json?all=1") for name in row["Names"]}
    require("/" + shadow_name not in names and "/" + rollback_name not in names, "owned temporary name already exists")
    shadow_id = replacement_id = image = None
    shadow_attempted = False
    armed = False
    def interrupted(signum, frame):
        raise Blocked("interrupted")
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, interrupted)
    try:
        with tempfile.TemporaryDirectory(prefix="coconut-hotfix-", dir=STATE) as temporary:
            repo = Path(temporary) / "source"
            command("git", "clone", "--quiet", "--no-checkout", "--branch", BRANCH, REPO, str(repo))
            remote = command("git", "-C", str(repo), "rev-parse", "refs/remotes/origin/" + BRANCH).decode().strip()
            require(remote == CANDIDATE, "remote branch advanced")
            command("git", "-C", str(repo), "checkout", "--quiet", "--detach", CANDIDATE)
            validate_tree(repo, BRANCH, CANDIDATE)
            image_sources(repo, NAME, BASE)
            archive = command("git", "-C", str(repo), "archive", "--format=tar", CANDIDATE)
            iid = Path(temporary) / "image-id"
            command("docker", "build", "--iidfile", str(iid), "--build-arg", "MFMS_GIT_COMMIT=" + CANDIDATE,
                    "--build-arg", "MFMS_BUILD_ENVIRONMENT=Preview", "--build-arg", "MFMS_BUILD_TIMESTAMP=" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()),
                    "-f", "api/Dockerfile", "-", data=archive, retain_build=True)
            image = iid.read_text().strip()
            require(image.startswith("sha256:") and len(image) == 71, "immutable image ID unavailable")
            labels = docker("GET", "/images/" + image + "/json")["Config"]["Labels"]
            require(labels["org.opencontainers.image.revision"] == CANDIDATE and labels["com.muthufarms.mfms.environment"] == "Preview", "built image identity")
            timestamp = labels["org.opencontainers.image.created"]
            shadow_attempted = True
            shadow_id = docker("POST", "/containers/create?name=" + shadow_name, create_payload(live, image, CANDIDATE, True, timestamp))["Id"]
            docker("POST", "/containers/" + shadow_id + "/start")
            validate_shadow(inspect(shadow_id), image)
            health(8016, CANDIDATE)
            image_sources(repo, shadow_name, CANDIDATE)
            database_probe(shadow_name, ledger)
            require(protected({live["Id"], shadow_id}) == before, "unrelated container changed")
            docker("DELETE", "/containers/" + shadow_id + "?force=1")
            shadow_id = None
            shadow_attempted = False
            original_unchanged()
            fresh = inspect()
            validate_live(fresh)
            require(fresh["Id"] == live["Id"] and fresh["Config"] == live["Config"] and fresh["HostConfig"] == live["HostConfig"], "live runtime changed")
            database_probe(NAME, ledger)
            require(protected({live["Id"]}) == before, "unrelated container changed before switch")
            # No live mutation occurs before rollback has been armed.
            armed = True
            docker("POST", "/containers/" + live["Id"] + "/stop?t=30")
            docker("POST", "/networks/" + NETWORK_ID + "/disconnect", {"Container": live["Id"], "Force": False})
            docker("POST", "/containers/" + live["Id"] + "/rename?name=" + rollback_name)
            payload = create_payload(live, image, CANDIDATE, timestamp=timestamp)
            replacement_id = docker("POST", "/containers/create?name=" + NAME, payload)["Id"]
            docker("POST", "/containers/" + replacement_id + "/start")
            health(8015, CANDIDATE)
            validate_live(inspect(), CANDIDATE, image)
            installed = inspect()
            require(installed["HostConfig"] == live["HostConfig"], "replacement runtime configuration differs")
            require(installed["Config"]["Env"] == payload["Env"], "replacement environment differs")
            database_probe(NAME, ledger)
            image_sources(repo, NAME, CANDIDATE)
            original_unchanged()
            require(protected({live["Id"], replacement_id}) == before, "unrelated container changed after switch")
            require(inspect(rollback_name)["Image"] == BASE_IMAGE, "rollback target not retained")
            docker("GET", "/images/" + BASE_IMAGE + "/json")
        # Keep restoration armed until source workspace cleanup has completed.
        print(json.dumps({"result": "PASS", "revision": CANDIDATE, "image": image, "container": replacement_id,
                          "rollback_container": live["Id"], "rollback_image": BASE_IMAGE, "ledger_count": 23, "ledger_hash": LEDGER_HASH}))
        armed = False
    finally:
        if armed:
            # Ignore repeated termination during the bounded restoration steps.
            for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
                signal.signal(sig, signal.SIG_IGN)
            restore(live, image, ledger)
        if shadow_attempted:
            cleanup_shadow(shadow_name, image)


def restore(live, image, ledger):
    try:
        restore_observed(live, image, ledger)
    except Exception as error:
        raise Blocked("AUTOMATIC ROLLBACK FAILED: " + type(error).__name__) from None


def restore_observed(live, image, ledger):
    # Reconcile observed Docker state: an API response may be lost after mutation.
    errors = []
    def attempt(action):
        try:
            action()
        except Exception as error:
            errors.append(type(error).__name__)
    rows = docker("GET", "/containers/json?all=1")
    for row in rows:
        if "/" + NAME in row["Names"] and row["Id"] != live["Id"]:
            require(row["ImageID"] == image, "rollback refuses unowned replacement")
            attempt(lambda: docker("DELETE", "/containers/" + row["Id"] + "?force=1"))
    original = inspect(live["Id"])
    require(original["Image"] == BASE_IMAGE, "rollback original image changed")
    if original["Name"] != "/" + NAME:
        attempt(lambda: docker("POST", "/containers/" + live["Id"] + "/rename?name=" + NAME))
    if NETWORK not in original["NetworkSettings"]["Networks"]:
        attempt(lambda: docker("POST", "/networks/" + NETWORK_ID + "/connect", {"Container": live["Id"], "EndpointConfig": {"IPAMConfig": {"IPv4Address": IP}}}))
    if not inspect(live["Id"])["State"]["Running"]:
        attempt(lambda: docker("POST", "/containers/" + live["Id"] + "/start"))
    try:
        health(8015, BASE)
        validate_live(inspect())
        require(inspect()["Id"] == live["Id"], "rollback original identity not restored")
        database_probe(NAME, ledger)
        original_unchanged()
    except Exception as error:
        raise Blocked("AUTOMATIC ROLLBACK FAILED: " + type(error).__name__) from None
    print("PREVIEW_COCONUT_ROLLBACK=PASS", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never serialize Docker configuration, subprocess stderr, or credentials.
        print("PREVIEW_COCONUT_HOTFIX_BLOCKED=" + (str(error) if isinstance(error, Blocked) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
