#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--approved-recovery REFERENCE] DEPLOYED_FRONTEND CANDIDATE_FRONTEND DEPLOYED_BACKEND CANDIDATE_BACKEND [FRONTEND_REPO] [BACKEND_REPO] [SCOPE_FILE]" >&2
}

recovery_reference=""
if [[ ${1:-} == "--approved-recovery" ]]; then
  recovery_reference=${2:-}
  shift 2
  if [[ -z "$recovery_reference" || -z "${PREVIEW_RECOVERY_APPROVED_BY:-}" ]]; then
    echo "DEPLOYMENT BLOCKED — RECOVERY REQUIRES AN APPROVAL REFERENCE AND PREVIEW_RECOVERY_APPROVED_BY" >&2
    exit 2
  fi
fi

[[ $# -ge 4 ]] || { usage; exit 2; }
deployed_frontend=$1
candidate_frontend=$2
deployed_backend=$3
candidate_backend=$4
frontend_repo=${5:-$(pwd)}
backend_repo=${6:-../muthu-harvest-dashboard-preview-release}
scope_file=${7:-$frontend_repo/deploy/approved-change-scope.txt}

blocked() {
  echo "DEPLOYMENT BLOCKED — $1" >&2
  exit 1
}

verify_repo_state() {
  local label=$1 repo=$2
  [[ -d "$repo/.git" || -f "$repo/.git" ]] || blocked "$label REPOSITORY IS INVALID: $repo"
  local branch head upstream ahead_behind changed
  branch=$(git -C "$repo" branch --show-current)
  head=$(git -C "$repo" rev-parse HEAD)
  upstream=$(git -C "$repo" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo "none")
  if [[ "$upstream" == "none" ]]; then ahead_behind="untracked"; else ahead_behind=$(git -C "$repo" rev-list --left-right --count "$upstream...HEAD"); fi
  changed=$(git -C "$repo" status --short)
  echo "$label branch=$branch commit=$head upstream=$upstream ahead_behind=$ahead_behind"
  echo "$label changed files:"
  if [[ -n "$changed" ]]; then echo "$changed"; else echo "(none)"; fi
  [[ "$branch" == "preview-release" ]] || blocked "$label BRANCH MUST BE preview-release"
  git -C "$repo" symbolic-ref -q HEAD >/dev/null || blocked "$label DETACHED HEAD"
  [[ -z "$changed" ]] || blocked "$label WORKTREE IS NOT CLEAN"
  for marker in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
    [[ ! -e "$(git -C "$repo" rev-parse --git-path "$marker")" ]] || blocked "$label HAS PENDING $marker"
  done
  [[ ! -d "$(git -C "$repo" rev-parse --git-path rebase-merge)" ]] || blocked "$label HAS PENDING REBASE"
  [[ ! -d "$(git -C "$repo" rev-parse --git-path rebase-apply)" ]] || blocked "$label HAS PENDING REBASE"
  ! git -C "$repo" grep -nE '^(<<<<<<<|=======|>>>>>>>)' -- ':!*.lock' >/dev/null || blocked "$label CONTAINS CONFLICT MARKERS"
  echo "$label stash_count=$(git -C "$repo" stash list | wc -l | tr -d ' ')"
}

verify_ancestry() {
  local label=$1 repo=$2 deployed=$3 candidate=$4
  git -C "$repo" cat-file -e "$deployed^{commit}" || blocked "$label DEPLOYED COMMIT IS UNKNOWN: $deployed"
  git -C "$repo" cat-file -e "$candidate^{commit}" || blocked "$label CANDIDATE COMMIT IS UNKNOWN: $candidate"
  if ! git -C "$repo" merge-base --is-ancestor "$deployed" "$candidate"; then
    if [[ -n "$recovery_reference" ]]; then
      echo "RECOVERY EXCEPTION: $label ancestry bypass approved by ${PREVIEW_RECOVERY_APPROVED_BY}; reference=$recovery_reference"
    else
      echo "DEPLOYMENT BLOCKED — CANDIDATE DOES NOT CONTAIN THE CURRENT PREVIEW BASELINE" >&2
      echo "$label missing relationship: deployed=$deployed is not an ancestor of candidate=$candidate" >&2
      exit 1
    fi
  fi
  echo "$label ancestry=PASS deployed=$deployed candidate=$candidate"
}

load_scope() {
  grep -Ev '^[[:space:]]*(#|$)' "$scope_file" | sort -u
}

verify_scope() {
  local label=$1 prefix=$2 repo=$3 deployed=$4 candidate=$5
  local tmp_actual tmp_allowed tmp_unexpected tmp_status
  tmp_actual=$(mktemp); tmp_allowed=$(mktemp); tmp_unexpected=$(mktemp); tmp_status=$(mktemp)
  trap 'rm -f "$tmp_actual" "$tmp_allowed" "$tmp_unexpected" "$tmp_status"' RETURN
  git -C "$repo" diff --name-only "$deployed..$candidate" | sort -u > "$tmp_actual"
  load_scope | sed -n "s/^$prefix://p" | sort -u > "$tmp_allowed"
  comm -23 "$tmp_actual" "$tmp_allowed" > "$tmp_unexpected"
  git -C "$repo" diff --name-status -M "$deployed..$candidate" > "$tmp_status"
  echo "$label intended changed files:"; cat "$tmp_allowed"
  echo "$label actual changed files:"; cat "$tmp_actual"
  echo "$label deleted/renamed/config changes:"; grep -E '^(D|R)|(^|/)(Dockerfile|docker-compose|\\.env|next\\.config|deploy/)' "$tmp_status" || true
  [[ ! -s "$tmp_unexpected" ]] || { cat "$tmp_unexpected" >&2; blocked "$label DIFF CONTAINS FILES OUTSIDE APPROVED SCOPE"; }
  echo "$label diff_allowlist=PASS"
}

verify_repo_state FRONTEND "$frontend_repo"
verify_repo_state BACKEND "$backend_repo"
verify_ancestry FRONTEND "$frontend_repo" "$deployed_frontend" "$candidate_frontend"
verify_ancestry BACKEND "$backend_repo" "$deployed_backend" "$candidate_backend"
verify_scope FRONTEND frontend "$frontend_repo" "$deployed_frontend" "$candidate_frontend"
verify_scope BACKEND backend "$backend_repo" "$deployed_backend" "$candidate_backend"

echo "PREVIEW DEPLOYMENT CANDIDATE VERIFIED"
