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

## 2026-07-28 10:50 IST — Homepage and sidebar navigation consistency

- Purpose: make the 15 homepage tiles and module sidebar derive labels, icons, routes, order, and availability from one authoritative configuration.
- Approved frontend scope: `lib/mfms-navigation.ts`, `lib/home-data.ts`, `components/farm/sidebar.tsx`, `components/farm/dashboard-shell.tsx`, `tests/navigation-consistency.mjs`, and the test script in `package.json`.
- Previous frontend: deployed application commit `01c79cd57bbd2ce15e297ae11269c77980baefff`, image `mfms-v0-preview:morning-difference-01c79cd-20260728-0925`, ID `sha256:78889ee1a157939f327780cd10703c6a9806c1c6091e6658684b753d78b02135`.
- New frontend: commit `94baca49feda4b04c3bcdc76557ac30129370248`, image `mfms-v0-preview:navigation-94baca4-20260728-1030`, ID `sha256:c5c80b5e975216147bb541d26f6c6165583024bc9290b108aa1dd251ee2550e1`.
- Backend: unchanged at commit `ca03f1dc7dff71a58f4e2d3badda754f979efe03`, image ID `sha256:62789947311cc6af0b825c4cee76928419ed0cfb5f4144bffeb17c3420c3eb01`.
- Root cause: separate hard-coded Reports and Settings sidebar entries used `href="#"`; fragment navigation retained the current Coconut page. Farm Reports now shares its homepage Coming Soon route, and Settings is omitted because no homepage tile or route exists.
- Homepage: exactly 15 existing tiles retained. Sidebar: Dashboard plus all 14 module tiles; no fragment links.
- Coming Soon: existing Option C retained; Weather History, Farm Reports, and Worker Management show a Soon badge and link to `/under-construction`.
- Tests: shared configuration, routes, labels/icons, active states, Coming Soon, desktop/mobile invariants, regression tests, TypeScript, and production build passed.
- Live verification: all unique active and Coming Soon destinations returned HTTP 200; Coconut and Well Water active states passed; Farm Reports click opened `/under-construction`; Settings absent.
- Database, backend, ODK, cron, and Production: unchanged.
- Checkpoint: `/home/muthu/mfms_checkpoints/preview-navigation-consistency-prechange-20260728-102052/`.
- Rollback: restore retained container `mfms-pilot-web-pre-navigation-20260728-1040`, or recreate only the frontend from image ID `sha256:78889ee1a157939f327780cd10703c6a9806c1c6091e6658684b753d78b02135`.
- Approver: user request in this task.
- Verdict: passed.

## 2026-07-28 10:10 IST — South Well 74-foot reference correction

- Purpose: interpret South Well ODK feet/inches as a downward tape reading from the fixed 74-foot reference and derive morning/evening water depth and volume dynamically.
- Approved backend scope: `api/app/services/well_water_dashboard.py`, `api/app/routers/well_water.py`, `scripts/sync_well_water_odk.py`, and `tests/test_well_water_dashboard.py`.
- Frontend: unchanged at deployed application commit `01c79cd57bbd2ce15e297ae11269c77980baefff`, image `mfms-v0-preview:morning-difference-01c79cd-20260728-0925`, ID `sha256:78889ee1a157939f327780cd10703c6a9806c1c6091e6658684b753d78b02135`.
- Previous backend: commit `43d4bdf1780e4ee0d84fe2669cf34fa4148dc4f4`, image `muthu-harvest-dashboard-harvest-api:preview-morning-difference-43d4bdf-20260728-0925`, ID `sha256:3e943a02a93f7e9e72bed9eda1b520637aee9af00b90554919cd74e170602eb9`.
- New backend: commit `ca03f1dc7dff71a58f4e2d3badda754f979efe03`, image `muthu-harvest-dashboard-harvest-api:preview-south-well-reference-ca03f1d-20260728-1000`, ID `sha256:62789947311cc6af0b825c4cee76928419ed0cfb5f4144bffeb17c3420c3eb01`.
- Formula: South actual depth inches = `888 - tape_reading_total_inches`; precise litres per inch = configured `632,531 / 486 = 1,301.504115226337...`; only final public values are rounded.
- Database: `mfms_server_uat`; 18 South raw readings, zero North readings; no schema, configuration, raw ODK, or row changes.
- Historical reconciliation: all 18 South rows recalculated dynamically; zero invalid and zero capacity-conflict readings; North API payload unchanged.
- Tests: 28 backend tests passed, including all requested boundaries, invalid/conflict handling, morning/evening values, motor-derived pumped-out value, consecutive morning differences, and North separation. Frontend regression/export and typecheck passed.
- Live UI: South 28 July morning `317,567 L`, 27 July evening `295,441 L`, differences `−2,603`, `+1,302`, and `0` displayed; North remains unavailable.
- Migration and cron changes: none; Preview Harvest automatic sync remains disabled, Well Water remains `30 3,13 * * *`, and Beetle remains unchanged.
- Checkpoint: `/home/muthu/mfms_checkpoints/preview-south-well-reference-prechange-20260728-042538/`.
- Rollback: restore retained container `harvest-api-pilot-pre-south-well-reference-20260728-1005`, or recreate only the backend from image ID `sha256:3e943a02a93f7e9e72bed9eda1b520637aee9af00b90554919cd74e170602eb9`.
- Approver: user request in this task.
- Verdict: passed.

## 2026-07-28 09:40 IST — Difference in Morning Readings

- Purpose: replace the misleading Estimated Recharge measure with the signed difference between valid morning water volumes on consecutive calendar dates, independently for each well.
- Approved frontend scope: `app/well-water/page.tsx`, `components/farm/summary-cards.tsx`, `components/farm/well-chart.tsx`, `components/farm/well-table.tsx`, `lib/home-data.ts`, `lib/well-data.ts`, and `tests/well-water-authoritative-daily-values.mjs`.
- Approved backend scope: `api/app/routers/well_water.py`, `api/app/services/well_water_dashboard.py`, and `tests/test_well_water_dashboard.py`.
- Previous frontend: commit `e71e6da0cfb3adaa06b87b2a54ac5aa3f3f8d6b6`; deployed image `mfms-v0-preview:manual-harvest-sync-77a7eac-20260727-201952`, ID `sha256:5efb601b223dd9dbfebca20a5c372c16eed5e82549376d1a0fbe85a92005bb4e`.
- New frontend: commit `01c79cd57bbd2ce15e297ae11269c77980baefff`; image `mfms-v0-preview:morning-difference-01c79cd-20260728-0925`, ID `sha256:78889ee1a157939f327780cd10703c6a9806c1c6091e6658684b753d78b02135`.
- Previous backend: commit `b594ff60e9509ae01b5b352ae3a9879a8fc2ab1b`; image `muthu-harvest-dashboard-harvest-api:preview-well1-precision-b594ff6-20260728-0850`, ID `sha256:b898c63f0f40b1414862bdafb48b4eb5672956cd267efe966cf73a5ade9567f4`.
- New backend: commit `43d4bdf1780e4ee0d84fe2669cf34fa4148dc4f4`; image `muthu-harvest-dashboard-harvest-api:preview-morning-difference-43d4bdf-20260728-0925`, ID `sha256:3e943a02a93f7e9e72bed9eda1b520637aee9af00b90554919cd74e170602eb9`.
- Formula: current date valid morning water litres minus the immediately preceding calendar date valid morning water litres for the same well; unavailable comparisons return `null`.
- Database: `mfms_server_uat`; no schema, configuration, raw submission, or row changes.
- Migration and cron changes: none; Preview Harvest automatic sync remains disabled, Well Water remains `30 3,13 * * *`, and Beetle remains unchanged.
- Tests: 22 backend tests passed; frontend tests, typecheck, and production build passed; candidate and live API results were South `−2,600`, `+1,300`, `0`, `−1,300`, while deleted North history remained unavailable.
- Live UI: exact table label, signed values, chart zero line and Morning Difference legend verified; CSV export contract passed; old terminology absent.
- Checkpoint: `/home/muthu/mfms_checkpoints/preview-well-morning-difference-prechange-20260728-091150/`.
- Rollback: restore retained containers `mfms-pilot-web-pre-morning-difference-20260728-0938` and `harvest-api-pilot-pre-morning-difference-20260728-0938`, or rebuild only the prior immutable images listed above.
- Approver: user request in this task.
- Verdict: passed.

## 2026-07-28 08:58 IST — Well 1 precision correction

- Purpose: remove the rounded 1,650-litre internal multiplier for Well 1 and derive the precise conversion from approved full capacity divided by the 684-inch full-water column.
- Approved scope: `api/app/services/well_water_dashboard.py`, `api/app/routers/well_water.py`, and `tests/test_well_water_dashboard.py`.
- Previous frontend: unchanged at commit `77a7eac4f21869af456dac81d83536d6c4103ca4`, image ID `sha256:5efb601b223dd9dbfebca20a5c372c16eed5e82549376d1a0fbe85a92005bb4e`.
- New frontend: unchanged; no frontend build or restart.
- Previous backend: commit `c7a858946cfc0ff904611914c0ff63ca21746ce5`, image ID `sha256:0470047dd3cfaa92bc51a4ba3dd5537116b0e8e3ad9e36df377d7582d502e744`.
- New backend: commit `b594ff60e9509ae01b5b352ae3a9879a8fc2ab1b`, image `muthu-harvest-dashboard-harvest-api:preview-well1-precision-b594ff6-20260728-0850`, ID `sha256:b898c63f0f40b1414862bdafb48b4eb5672956cd267efe966cf73a5ade9567f4`.
- Database: `mfms_server_uat`; no schema, configuration, raw submission, or row changes.
- Precise conversion: `1,128,270 / 684 = 1,649.517543859649...` litres per inch; rounding occurs only at the public API/display boundary.
- Tests: 20 Well Water tests passed; full-water boundary and overfill validation passed; all 17 historical Well 1 rows reconciled; Well 2 API output was identical.
- Live verification: 37 ft 9 in returns 35 ft 3 in and 697,746 litres; UI displays 6,97,746 with no console errors.
- Checkpoint: `/home/muthu/mfms_checkpoints/preview-well1-precision-prechange-20260728-20260728-084325/`.
- Rollback: replace only `harvest-api-pilot` with retained container `harvest-api-pilot-pre-precision-20260728-0855` or immutable image ID `sha256:0470047dd3cfaa92bc51a4ba3dd5537116b0e8e3ad9e36df377d7582d502e744`.
- Cron and ODK: unchanged; no sync run.
- Verdict: passed.
