#!/usr/bin/env python3
"""Fail-closed semantic guard for the one-time Production auth cutover.

The guard deliberately never writes or logs session identifiers, CSRF values,
cookies, IP addresses, user agents, or its ephemeral HMAC key.  Its protected
state directory is the only place that contains the byte-exact rollback copy
and non-reversible comparison seals.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import stat
import sys
from typing import Any


REQUIRED_FIELDS = {
    "canonicalUsername",
    "csrfToken",
    "createdAt",
    "lastSeenAt",
    "expiresAt",
    "ip",
    "userAgent",
}


class GuardError(Exception):
    """A sanitized, user-visible guard failure."""


def fail(message: str) -> None:
    raise GuardError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def regular_file(path: Path, label: str) -> os.stat_result:
    try:
        info = path.lstat()
    except OSError:
        fail(f"{label} is unavailable")
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        fail(f"{label} is not a protected regular file")
    if os.name != "nt" and stat.S_IMODE(info.st_mode) != 0o600:
        fail(f"{label} permissions are not 0600")
    if os.name != "nt" and (info.st_uid != os.geteuid() or info.st_gid != os.getegid()):
        fail(f"{label} ownership is invalid")
    return info


def state_directory(path: Path) -> os.stat_result:
    try:
        info = path.lstat()
    except OSError:
        fail("guard state directory is unavailable")
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        fail("guard state directory is invalid")
    if os.name != "nt" and stat.S_IMODE(info.st_mode) != 0o700:
        fail("guard state directory permissions are not 0700")
    if os.name != "nt" and (info.st_uid != os.geteuid() or info.st_gid != os.getegid()):
        fail("guard state directory ownership is invalid")
    return info


def read_bytes(path: Path, label: str) -> tuple[bytes, os.stat_result]:
    info = regular_file(path, label)
    try:
        data = path.read_bytes()
    except OSError:
        fail(f"{label} is unreadable")
    return data, info


def strict_int(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        fail(f"session store has an invalid {label}")
    return value


def parse_sessions(raw: bytes) -> dict[str, dict[str, Any]]:
    if not raw.strip():
        fail("session store is empty")
    try:
        document = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail("session store is malformed")
    if not isinstance(document, dict) or set(document) != {"version", "sessions"}:
        fail("session store schema is invalid")
    if document.get("version") != 1 or not isinstance(document.get("sessions"), dict):
        fail("session store version is invalid")
    sessions = document["sessions"]
    if not sessions:
        fail("session inventory is empty")
    normalized: dict[str, dict[str, Any]] = {}
    for key, record in sessions.items():
        if not isinstance(key, str) or not key:
            fail("session inventory contains an invalid identifier")
        if not isinstance(record, dict) or set(record) != REQUIRED_FIELDS:
            fail("session inventory contains an invalid record schema")
        username = record.get("canonicalUsername")
        csrf = record.get("csrfToken")
        ip = record.get("ip")
        user_agent = record.get("userAgent")
        if not isinstance(username, str) or not username.strip():
            fail("session inventory contains an invalid username")
        if username != username.strip().casefold():
            fail("session inventory contains a non-canonical username")
        if not isinstance(csrf, str) or not csrf:
            fail("session inventory contains invalid authentication material")
        if not isinstance(ip, str) or not isinstance(user_agent, str):
            fail("session inventory contains invalid request metadata")
        created = strict_int(record.get("createdAt"), "creation time")
        last_seen = strict_int(record.get("lastSeenAt"), "last-seen time")
        expires = strict_int(record.get("expiresAt"), "fixed expiry")
        if created > last_seen or last_seen >= expires:
            fail("session inventory contains inconsistent timestamps")
        normalized[key] = dict(record)
    return normalized


def parse_audit(raw: bytes, label: str) -> list[dict[str, Any]]:
    if not raw:
        return []
    if not raw.endswith(b"\n"):
        fail(f"{label} is not newline-terminated")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        fail(f"{label} is malformed")
    records: list[dict[str, Any]] = []
    for line in text.splitlines():
        if not line.strip():
            fail(f"{label} contains an empty record")
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            fail(f"{label} is malformed")
        if not isinstance(record, dict):
            fail(f"{label} contains an invalid record")
        records.append(record)
    return records


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def seal(key: bytes, domain: bytes, value: bytes) -> str:
    return hmac.new(key, domain + b"\0" + value, hashlib.sha256).hexdigest()


def private_write(path: Path, data: bytes) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags, 0o600)
    except OSError:
        fail("guard state already exists or cannot be created")
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
    except OSError:
        fail("guard state could not be written")


def file_metadata(info: os.stat_result) -> dict[str, int]:
    return {
        "mode": stat.S_IMODE(info.st_mode),
        "uid": info.st_uid,
        "gid": info.st_gid,
    }


def validate_metadata(info: os.stat_result, expected: dict[str, int], label: str) -> None:
    observed = file_metadata(info)
    if observed != expected:
        fail(f"{label} ownership or permissions changed")


def load_key(state: Path) -> bytes:
    raw, _ = read_bytes(state / "comparison.key", "comparison key")
    if len(raw) != 32:
        fail("comparison key is invalid")
    return raw


def load_manifest(state: Path) -> dict[str, Any]:
    raw, _ = read_bytes(state / "manifest.json", "guard manifest")
    try:
        manifest = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail("guard manifest is malformed")
    if not isinstance(manifest, dict) or manifest.get("guardVersion") != 1:
        fail("guard manifest is invalid")
    return manifest


def snapshot(args: argparse.Namespace) -> None:
    state = Path(args.state)
    state_directory(state)
    if args.cutoff_ms <= 0 or args.idle_ms <= 0:
        fail("guard timing policy is invalid")
    sessions_raw, sessions_info = read_bytes(Path(args.sessions), "session store")
    users_raw, users_info = read_bytes(Path(args.users), "user store")
    audit_raw, audit_info = read_bytes(Path(args.audit), "audit store")
    sessions = parse_sessions(sessions_raw)
    parse_audit(audit_raw, "audit store")
    required_users = {str(value).strip().casefold() for value in args.require_active_user}
    if any(not value for value in required_users):
        fail("required active-session user is invalid")
    for username in required_users:
        if not any(
            record["canonicalUsername"] == username
            and record["expiresAt"] > args.cutoff_ms
            and record["lastSeenAt"] + args.idle_ms > args.cutoff_ms
            for record in sessions.values()
        ):
            fail("a required active Production session is unavailable at T0")
    comparison_key = secrets.token_bytes(32)
    entries = []
    for identifier, record in sessions.items():
        identifier_seal = seal(comparison_key, b"identifier", identifier.encode("utf-8"))
        full_seal = seal(comparison_key, b"record", canonical_json(record))
        static_record = {key: value for key, value in record.items() if key != "lastSeenAt"}
        static_seal = seal(comparison_key, b"static", canonical_json(static_record))
        active = record["expiresAt"] > args.cutoff_ms and record["lastSeenAt"] + args.idle_ms > args.cutoff_ms
        entries.append({
            "identifierSeal": identifier_seal,
            "fullSeal": full_seal,
            "staticSeal": static_seal,
            "canonicalUsername": record["canonicalUsername"],
            "createdAt": record["createdAt"],
            "lastSeenAt": record["lastSeenAt"],
            "expiresAt": record["expiresAt"],
            "activeAtT0": active,
        })
    entries.sort(key=lambda item: item["identifierSeal"])
    manifest = {
        "guardVersion": 1,
        "cutoffMs": args.cutoff_ms,
        "idleMs": args.idle_ms,
        "sessionSha256": sha256(sessions_raw),
        "sessionMetadata": file_metadata(sessions_info),
        "usersSha256": sha256(users_raw),
        "usersMetadata": file_metadata(users_info),
        "auditSha256": sha256(audit_raw),
        "auditLength": len(audit_raw),
        "auditMetadata": file_metadata(audit_info),
        "entries": entries,
    }
    private_write(state / "comparison.key", comparison_key)
    private_write(state / "sessions.t0.backup", sessions_raw)
    private_write(state / "audit.t0.backup", audit_raw)
    private_write(state / "manifest.json", canonical_json(manifest) + b"\n")
    print(f"SESSION_GUARD_SNAPSHOT=PASS active={sum(1 for item in entries if item['activeAtT0'])} expired={sum(1 for item in entries if not item['activeAtT0'])}")


def timestamp_ms(value: Any) -> int | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        from datetime import datetime

        normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return None
        return int(parsed.timestamp() * 1000)
    except (ValueError, OverflowError):
        return None


def audited_touch_allowed(
    before: dict[str, Any],
    after: dict[str, Any],
    appended: list[dict[str, Any]],
    active_user_counts: dict[str, int],
    cutoff_ms: int,
    observed_ms: int,
) -> int | None:
    username = before["canonicalUsername"]
    if active_user_counts.get(username) != 1:
        return None
    if after["lastSeenAt"] <= before["lastSeenAt"] or after["lastSeenAt"] > observed_ms:
        return None
    for index, event in enumerate(appended):
        if event.get("event") != "login_existing_session_redirect":
            continue
        if str(event.get("actor") or "").strip().casefold() != username:
            continue
        event_ms = timestamp_ms(event.get("timestamp"))
        if event_ms is None or not cutoff_ms <= event_ms <= observed_ms:
            continue
        if event_ms < after["lastSeenAt"]:
            continue
        return index
    return None


def compare(args: argparse.Namespace) -> None:
    state = Path(args.state)
    state_directory(state)
    manifest = load_manifest(state)
    comparison_key = load_key(state)
    if args.observed_ms < manifest["cutoffMs"]:
        fail("guard observation time is invalid")
    sessions_raw, sessions_info = read_bytes(Path(args.sessions), "session store")
    users_raw, users_info = read_bytes(Path(args.users), "user store")
    audit_raw, audit_info = read_bytes(Path(args.audit), "audit store")
    validate_metadata(sessions_info, manifest["sessionMetadata"], "session store")
    validate_metadata(users_info, manifest["usersMetadata"], "user store")
    validate_metadata(audit_info, manifest["auditMetadata"], "audit store")
    if sha256(users_raw) != manifest["usersSha256"]:
        fail("user store changed during guarded startup")
    audit_backup, _ = read_bytes(state / "audit.t0.backup", "audit rollback copy")
    if sha256(audit_backup) != manifest["auditSha256"] or len(audit_backup) != manifest["auditLength"]:
        fail("audit rollback copy is invalid")
    if len(audit_raw) < len(audit_backup) or not audit_raw.startswith(audit_backup):
        fail("audit store was truncated or rewritten")
    appended_raw = audit_raw[len(audit_backup):]
    appended = parse_audit(appended_raw, "appended audit activity") if appended_raw else []
    current_sessions = parse_sessions(sessions_raw)
    before_entries = {item["identifierSeal"]: item for item in manifest["entries"]}
    current_entries: dict[str, tuple[dict[str, Any], str, str]] = {}
    for identifier, record in current_sessions.items():
        identifier_seal = seal(comparison_key, b"identifier", identifier.encode("utf-8"))
        full_seal = seal(comparison_key, b"record", canonical_json(record))
        static_record = {key: value for key, value in record.items() if key != "lastSeenAt"}
        static_seal = seal(comparison_key, b"static", canonical_json(static_record))
        current_entries[identifier_seal] = (record, full_seal, static_seal)
    additions = set(current_entries) - set(before_entries)
    if additions:
        fail("a new session appeared during guarded startup")
    active_user_counts: dict[str, int] = {}
    for item in manifest["entries"]:
        if item["activeAtT0"]:
            username = item["canonicalUsername"]
            active_user_counts[username] = active_user_counts.get(username, 0) + 1
    removed_expired = 0
    used_audit_events: set[int] = set()
    for identifier_seal, before in before_entries.items():
        current = current_entries.get(identifier_seal)
        if current is None:
            if before["activeAtT0"]:
                fail("a session active at T0 was removed")
            removed_expired += 1
            continue
        after, full_seal, static_seal = current
        if full_seal == before["fullSeal"]:
            continue
        if not before["activeAtT0"]:
            fail("a retained session expired at T0 changed")
        if static_seal != before["staticSeal"]:
            fail("protected session data changed")
        if after["lastSeenAt"] < before["lastSeenAt"]:
            fail("session last-seen time moved backward")
        event_index = audited_touch_allowed(
            before,
            after,
            appended,
            active_user_counts,
            manifest["cutoffMs"],
            args.observed_ms,
        )
        if event_index is None or event_index in used_audit_events:
            fail("session last-seen time advanced without unambiguous audit evidence")
        used_audit_events.add(event_index)
    if len(used_audit_events) != len(appended):
        fail("audit store contains unexpected activity during guarded startup")
    receipt = {
        "guardVersion": 1,
        "cutoffMs": manifest["cutoffMs"],
        "observedMs": args.observed_ms,
        "beforeCount": len(before_entries),
        "afterCount": len(current_entries),
        "removedExpiredAtT0": removed_expired,
        "auditedTouches": len(used_audit_events),
    }
    private_write(state / "comparison.passed.json", canonical_json(receipt) + b"\n")
    print(
        "SESSION_GUARD_COMPARE=PASS "
        f"before={len(before_entries)} after={len(current_entries)} "
        f"removed_expired_at_t0={removed_expired} audited_touches={len(used_audit_events)}"
    )


def restore(args: argparse.Namespace) -> None:
    state = Path(args.state)
    state_directory(state)
    manifest = load_manifest(state)
    backup, _ = read_bytes(state / "sessions.t0.backup", "session rollback copy")
    if sha256(backup) != manifest["sessionSha256"]:
        fail("session rollback copy hash is invalid")
    target = Path(args.sessions)
    target_info = regular_file(target, "session store")
    validate_metadata(target_info, manifest["sessionMetadata"], "session store")
    temporary = target.with_name(f".{target.name}.semantic-rollback-{os.getpid()}")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(temporary, flags, manifest["sessionMetadata"]["mode"])
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(backup)
            handle.flush()
            os.fsync(handle.fileno())
        if hasattr(os, "chown"):
            os.chown(temporary, manifest["sessionMetadata"]["uid"], manifest["sessionMetadata"]["gid"])
        os.chmod(temporary, manifest["sessionMetadata"]["mode"])
        os.replace(temporary, target)
        if os.name != "nt":
            directory_fd = os.open(target.parent, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    except OSError:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass
        fail("session rollback copy could not be restored")
    restored, restored_info = read_bytes(target, "restored session store")
    validate_metadata(restored_info, manifest["sessionMetadata"], "restored session store")
    if restored != backup:
        fail("session rollback restoration was not byte-exact")
    print("SESSION_GUARD_RESTORE=PASS")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(add_help=False)
    subparsers = result.add_subparsers(dest="operation", required=True)
    for operation in ("snapshot", "compare", "restore"):
        command = subparsers.add_parser(operation, add_help=False)
        command.add_argument("--sessions", required=True)
        command.add_argument("--state", required=True)
        if operation in {"snapshot", "compare"}:
            command.add_argument("--users", required=True)
            command.add_argument("--audit", required=True)
        if operation == "snapshot":
            command.add_argument("--cutoff-ms", required=True, type=int)
            command.add_argument("--idle-ms", required=True, type=int)
            command.add_argument("--require-active-user", action="append", default=[])
        if operation == "compare":
            command.add_argument("--observed-ms", required=True, type=int)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        if args.operation == "snapshot":
            snapshot(args)
        elif args.operation == "compare":
            compare(args)
        else:
            restore(args)
        return 0
    except GuardError as error:
        print(f"SESSION_GUARD_BLOCKED={error}", file=sys.stderr)
        return 1
    except Exception:
        print("SESSION_GUARD_BLOCKED=unexpected internal guard failure", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
