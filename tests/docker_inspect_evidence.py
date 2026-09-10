"""Lossless Docker evidence and narrowly scoped unordered-list canonicalization."""
import copy
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile
import traceback


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def sha(value):
    return hashlib.sha256(encode(value)).hexdigest()


def canonicalize(value, path=()):
    """Preserve all fields/types/duplicates; ordered arrays remain ordered."""
    if isinstance(value, dict):
        return {key: canonicalize(item, (*path, key)) for key, item in value.items()}
    if isinstance(value, list):
        items = [canonicalize(item, (*path, str(index))) for index, item in enumerate(value)]
        unordered = path == ("Mounts",) or (
            path == ("ExecIDs",) and all(type(item) is str for item in items)
        ) or (
            len(path) == 4 and path[:2] == ("NetworkSettings", "Networks")
            and path[3] in {"Aliases", "DNSNames"}
        )
        return sorted(items, key=encode) if unordered else items
    return value


def differences(before, after, path=()):
    """Structured exact values stay private; consumers may publish only counts."""
    if type(before) is not type(after):
        return [{"path": list(path), "change": "type", "before": before, "after": after}]
    if isinstance(before, dict):
        changes = []
        for key in sorted(set(before) | set(after)):
            if key not in before:
                changes.append({"path": [*path, key], "change": "added", "after": after[key]})
            elif key not in after:
                changes.append({"path": [*path, key], "change": "removed", "before": before[key]})
            else:
                changes.extend(differences(before[key], after[key], (*path, key)))
        return changes
    if isinstance(before, list):
        if len(before) != len(after):
            return [{"path": list(path), "change": "length", "before": before, "after": after}]
        return [change for index, (left, right) in enumerate(zip(before, after))
                for change in differences(left, right, (*path, index))]
    return [] if before == after else [{"path": list(path), "change": "value", "before": before, "after": after}]


def stable(item):
    """All inspection fields, except the changing health probe sample log.

    Health status/streak, every other State field and unknown future fields remain
    protected. The full probe log is retained in raw/canonical evidence and diffs.
    """
    value = copy.deepcopy(item)
    health = value.get("State", {}).get("Health")
    if isinstance(health, dict):
        health.pop("Log", None)
    return canonicalize(value)


def original_projection(item):
    value = {key: copy.deepcopy(item[key]) for key in
             ("Id", "Image", "Config", "HostConfig", "Mounts", "NetworkSettings")}
    value.update(Running=item["State"]["Running"], StartedAt=item["State"]["StartedAt"])
    return value


class Evidence:
    def __init__(self, parent):
        parent = Path(parent)
        for ancestor in parent.parents:
            if not ancestor.exists() and not ancestor.is_symlink():
                continue
            metadata = ancestor.lstat()
            if (not stat.S_ISDIR(metadata.st_mode) or ancestor.is_symlink()
                    or metadata.st_uid not in {0, os.getuid()} or metadata.st_mode & 0o022):
                raise RuntimeError("Unsafe evidence ancestor")
        parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        metadata = parent.lstat()
        if (not stat.S_ISDIR(metadata.st_mode) or parent.is_symlink()
                or metadata.st_uid != os.getuid() or stat.S_IMODE(metadata.st_mode) != 0o700):
            raise RuntimeError("Unsafe evidence parent")
        self.root = Path(tempfile.mkdtemp(prefix="lifecycle-", dir=parent))
        os.chmod(self.root, 0o700)
        self.sequence = 0
        self.previous = {}

    def write(self, name, value, *, raw=False):
        if name in {"", ".", ".."} or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-_." for char in name):
            raise RuntimeError("Unsafe evidence filename")
        payload = value if raw else encode(value)
        descriptor = os.open(self.root / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())

    def inspection(self, stdout):
        self.sequence += 1
        self.write(f"inspect-{self.sequence:04d}.raw.json", stdout.encode(), raw=True)
        raw_hash = hashlib.sha256(stdout.encode()).hexdigest()
        try:
            parsed = json.loads(stdout)
        except json.JSONDecodeError:
            self.write(f"inspect-{self.sequence:04d}.hashes.json", {"raw_stdout_sha256": raw_hash, "parse_status": "invalid-json"})
            return
        canonical = [canonicalize(item) for item in parsed] if isinstance(parsed, list) else canonicalize(parsed)
        self.write(f"inspect-{self.sequence:04d}.canonical.json", canonical)
        self.write(f"inspect-{self.sequence:04d}.hashes.json", {
            "raw_stdout_sha256": raw_hash, "canonical_sha256": sha(canonical)})
        changes = {}
        for item in parsed if isinstance(parsed, list) else []:
            if isinstance(item, dict) and isinstance(item.get("Id"), str):
                identity = item["Id"]
                if identity in self.previous:
                    changes[identity] = {"raw": differences(self.previous[identity], item),
                                         "canonical": differences(canonicalize(self.previous[identity]), canonicalize(item))}
                self.previous[identity] = copy.deepcopy(item)
        self.write(f"inspect-{self.sequence:04d}.diff.json", changes)

    def snapshot(self, label, items):
        canonical = {key: canonicalize(value) for key, value in items.items()}
        self.write(label + ".raw.json", items)
        self.write(label + ".canonical.json", canonical)
        self.write(label + ".hashes.json", {key: {"raw": sha(value), "canonical": sha(canonical[key])}
                                             for key, value in items.items()})
        self.write(label + ".manifest.json", {"last_inspect_sequence": self.sequence,
                                               "raw_file": label + ".raw.json", "canonical_file": label + ".canonical.json"})

    def failure(self, label, error):
        self.write(label + ".json", {"exception_type": type(error).__name__,
                                      "traceback": traceback.format_exc(), "last_inspect_sequence": self.sequence})

    def comparison(self, before, after, label="comparison"):
        raw_diff = differences(before, after)
        canonical_before = {key: canonicalize(value) for key, value in before.items()}
        canonical_after = {key: canonicalize(value) for key, value in after.items()}
        canonical_diff = differences(canonical_before, canonical_after)
        protected_before = {key: stable(value) for key, value in before.items()}
        protected_after = {key: stable(value) for key, value in after.items()}
        protected_diff = differences(protected_before, protected_after)
        old_before = {key: original_projection(value) for key, value in before.items()}
        old_after = {key: original_projection(value) for key, value in after.items()}
        old_canonical_before = {key: canonicalize(value) for key, value in old_before.items()}
        old_canonical_after = {key: canonicalize(value) for key, value in old_after.items()}
        old_raw_diff = differences(old_before, old_after)
        old_canonical_diff = differences(old_canonical_before, old_canonical_after)
        self.write(label + ".json", {"raw": raw_diff, "canonical": canonical_diff, "protected": protected_diff,
                                    "original_projection_raw": old_raw_diff,
                                    "original_projection_canonical": old_canonical_diff,
                                    "original_projection_hashes": {"before_raw": sha(old_before), "after_raw": sha(old_after),
                                       "before_canonical": sha(old_canonical_before), "after_canonical": sha(old_canonical_after)}})
        summary = {"raw_changes": len(raw_diff), "canonical_changes": len(canonical_diff),
                   "original_projection_raw_changes": len(old_raw_diff), "original_projection_canonical_changes": len(old_canonical_diff),
                   "protected_changes": len(protected_diff), "before_sha256": sha(protected_before),
                   "after_sha256": sha(protected_after)}
        self.write(label + ".summary.json", summary)
        return summary
