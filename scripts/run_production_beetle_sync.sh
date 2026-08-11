#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER="harvest-api"
LOCK_DIR="${XDG_STATE_HOME:-/home/muthu/.local/state}/mfms-production-sync"
LOCK_FILE="$LOCK_DIR/beetle-trap.lock"
EXPECTED_ENVIRONMENT="production"
EXPECTED_DATABASE="mfms_server_prod"
EXPECTED_PROJECT_ID="22"
EXPECTED_FORM_ID="mfms_preview_beetle_test_v1"

install -d -m 0700 "$LOCK_DIR"
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  printf '[%s] Production Beetle sync skipped: another run is active.\n' "$(TZ=Asia/Kolkata date -Is)"
  exit 0
fi

docker inspect "$CONTAINER" >/dev/null

docker exec -i \
  -e EXPECTED_ENVIRONMENT="$EXPECTED_ENVIRONMENT" \
  -e EXPECTED_DATABASE="$EXPECTED_DATABASE" \
  -e EXPECTED_PROJECT_ID="$EXPECTED_PROJECT_ID" \
  -e EXPECTED_FORM_ID="$EXPECTED_FORM_ID" \
  "$CONTAINER" python - <<'PY'
import base64
import json
import os
import urllib.error
import urllib.request

expected = {
    "MFMS_ENV": os.environ["EXPECTED_ENVIRONMENT"],
    "MFMS_TARGET_DATABASE": os.environ["EXPECTED_DATABASE"],
    "ODK_BEETLE_COUNT_PROJECT_ID": os.environ["EXPECTED_PROJECT_ID"],
    "ODK_BEETLE_COUNT_FORM_ID": os.environ["EXPECTED_FORM_ID"],
}
for name, value in expected.items():
    if os.environ.get(name, "").strip() != value:
        raise SystemExit(f"Production Beetle sync refused: {name} target mismatch.")

username = os.environ["API_ADMIN_USERNAME"]
password = os.environ["API_ADMIN_PASSWORD"]
token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
request = urllib.request.Request(
    "http://127.0.0.1:8000/api/admin/beetle-trap/sync",
    method="POST",
    headers={"Authorization": f"Basic {token}", "Accept": "application/json"},
)

try:
    with urllib.request.urlopen(request, timeout=150) as response:
        payload = json.load(response)
except urllib.error.HTTPError as exc:
    detail = exc.read().decode("utf-8", errors="replace")
    raise SystemExit(f"Production Beetle sync failed with HTTP {exc.code}: {detail}") from exc

print(
    json.dumps(
        {
            "status": payload.get("status"),
            "submissions_checked": payload.get("submissions_checked"),
            "new_records_imported": payload.get("new_records_imported"),
            "already_imported_records_skipped": payload.get("already_imported_records_skipped"),
            "records_rejected_or_failed": payload.get("records_rejected_or_failed"),
            "sync_completed_at": payload.get("sync_completed_at"),
        },
        sort_keys=True,
    )
)
PY
