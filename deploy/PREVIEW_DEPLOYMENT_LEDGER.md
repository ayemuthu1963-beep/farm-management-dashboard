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

### Framework verification result — 2026-07-27 21:00 IST

- Governance commits: `11acf8d30f28ed1f0661f909d74b8fb4409cccfe`, `d88810fcb0a8cbd9bdd8c27da8b95f8315f988d2`, `4e3eaa2553b9c4227b3aacbab853b8267e085dc3`.
- Positive ancestry, clean-worktree and allowlist gate: passed.
- Older candidate `910adce1b0a84ac8263658387eccab7ff55bbb6d`: blocked because it does not contain deployed frontend `77a7eac4f21869af456dac81d83536d6c4103ca4`.
- Mandatory route smoke test: 21/21 passed against the unchanged public Preview container.
- Live-data contracts: passed.
- Configuration drift: zero critical drift; private root crontab unverified due privilege.
- Candidate-container workflow: dry-run passed; no candidate or public container was started or replaced.
- Final verdict: framework complete; direct v0/older/non-ancestor deployment blocked.

## 2026-07-27 — Administrative finalisation

- Root scheduler attestation supplied by the user: `sudo crontab -l` returned `no crontab for root`.
- Root crontab status: `VERIFIED — ROOT HAS NO CRONTAB`.
- Root Preview Harvest schedule: absent.
- Root Preview Well Water schedule: absent.
- Duplicate privileged scheduler: absent.
- User `muthu` Preview Harvest automatic sync: disabled.
- User `muthu` Preview Well Water schedule: `30 3,13 * * *`.
- Beetle schedules: unchanged.
- Deployed frontend application remains `77a7eac4f21869af456dac81d83536d6c4103ca4` at image `sha256:5efb601b223dd9dbfebca20a5c372c16eed5e82549376d1a0fbe85a92005bb4e`.
- Frontend safety-framework head before this administrative commit: `f8b923ac5ac9b74b2a5b54c1edf43c5eb957c937`; it was not deployed.
- Deployed and release backend commit: `7ea2456642a8fb62d5d640c379c3f1642f654bce`.
- Public Preview deployment: unchanged.

## 2026-07-27 21:58:08 IST — Authoritative backend source backup

- Purpose: create the private authoritative backend repository and back up only `preview-release`.
- Repository: `ayemuthu1963-beep/muthu-harvest-dashboard`.
- Remote: `https://github.com/ayemuthu1963-beep/muthu-harvest-dashboard.git`.
- Branch: `preview-release`.
- Local and remote head: `7ea2456642a8fb62d5d640c379c3f1642f654bce`.
- Tracking: `origin/preview-release`; ahead/behind `0/0`.
- Archive preservation: moved unchanged to `C:\MFMS_LOCAL\backups\backend-source-baselines\dq-backend-baseline-source.tar.gz`.
- Legacy note: `ayemuthu1963-beep/mfms-backend` remains a related but different history and is not an approved deployment source.
- Other branches and tags pushed: none.
- Deployed backend commit and image: unchanged.
- Public Preview and Production: unchanged.

## 2026-07-28 08:40 IST — Well 1 reference-depth calculation repair

- Purpose: correct Preview Well 1 derived water depth and volume while preserving raw ODK tape readings.
- Approved scope: `api/app/services/well_water_dashboard.py`, `api/app/routers/well_water.py`, `scripts/sync_well_water_odk.py`, and `tests/test_well_water_dashboard.py`.
- Previous frontend: unchanged at commit `77a7eac4f21869af456dac81d83536d6c4103ca4`, image `mfms-v0-preview:manual-harvest-sync-77a7eac-20260727-201952`, ID `sha256:5efb601b223dd9dbfebca20a5c372c16eed5e82549376d1a0fbe85a92005bb4e`.
- New frontend: unchanged; no frontend build or restart.
- Previous backend: commit `7ea2456642a8fb62d5d640c379c3f1642f654bce`, image `muthu-harvest-dashboard-harvest-api:preview-detailed-query-7ea2456-20260727-140654`, ID `sha256:079ee3cfb2959700cd4eabf053beda653ec13c5d13c97b540d3e7fb6a155e006`.
- New backend: commit `c7a858946cfc0ff904611914c0ff63ca21746ce5`, image `muthu-harvest-dashboard-harvest-api:preview-well1-reference-c7a8589-20260728-0830`, ID `sha256:0470047dd3cfaa92bc51a4ba3dd5537116b0e8e3ad9e36df377d7582d502e744`.
- Database: `mfms_server_uat`; no schema, configuration, or row changes.
- Formula: Well 1 actual depth is `(73 * 12) - tape_reading_total_inches`; volume uses the existing `1650` litres per inch.
- Migration changes: none.
- Cron changes: none; Harvest automatic sync remains disabled and Well Water remains `30 3,13 * * *`.
- Tests: 25 automated tests passed; six required boundary examples passed; candidate API passed; all 17 historical Well 1 rows reconciled; 27 Well 2 daily results remained identical.
- Live verification: 37 ft 9 in tape reading returns 35 ft 3 in and 697,950 litres; UI shows 697,950 litres.
- Checkpoint: `/home/muthu/mfms_checkpoints/preview-well1-water-calculation-prechange-20260728-20260728-082037/`.
- Rollback: replace only `harvest-api-pilot` with retained container `harvest-api-pilot-pre-well1-20260728-0833` or prior immutable image ID `sha256:079ee3cfb2959700cd4eabf053beda653ec13c5d13c97b540d3e7fb6a155e006`.
- Approver: user request in this task.
- Verdict: passed.
