# Preview Deployment Ledger

Entries are append-only. Never edit or delete an older entry.

## 2026-07-27 20:45:46 IST — Authoritative baseline and safety framework

- Purpose: establish the running consolidated Preview release as the protected baseline and add deployment governance without replacing public containers.
- Approved scope: files listed in `deploy/approved-change-scope.txt`.
- Previous frontend: `77a7eac4f21869af456dac81d83536d6c4103ca4`; `mfms-v0-preview:manual-harvest-sync-77a7eac-20260727-201952`; `sha256:5efb601b223dd9dbfebca20a5c372c16eed5e82549376d1a0fbe85a92005bb4e`.
- New frontend: unchanged public image; governance commit recorded after dry-run verification.
- Previous backend: `7ea2456642a8fb62d5d640c379c3f1642f654bce`; `muthu-harvest-dashboard-harvest-api:preview-detailed-query-7ea2456-20260727-140654`; `sha256:079ee3cfb2959700cd4eabf053beda653ec13c5d13c97b540d3e7fb6a155e006`.
- New backend: unchanged.
- Database: `mfms_server_uat`.
- Configuration changes: none.
- Migration changes: none.
- Cron changes: none.
- Tests: ancestry, clean-worktree, scope, negative ancestry, smoke, live contracts, drift.
- Checkpoint: `/home/muthu/mfms_checkpoints/preview-deployment-safety-framework-20260727-204546/`.
- Rollback: unchanged immutable running images above.
- Approver: user request in this task.
- Verdict: pending final dry-run result.
