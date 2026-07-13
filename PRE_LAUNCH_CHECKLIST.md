# MFMS Pre-Launch Checklist

Use this checklist before merging, deploying, or announcing a release.

## Release Candidate integration run — 2026-07-13

Status: **partial pass; deployment-readiness blockers remain**

Evidence recorded in this run:

- Frontend production build: **PASS** (`pnpm build`)
- TypeScript check: **PASS** (`tsc --noEmit`)
- Lint: **BLOCKED** — `eslint` is referenced by `pnpm lint` but is not installed in this branch.
- Backend Python syntax validation: **PASS** for `main.py`, Inventory, Well Water, Beetle Trap, Motor Runtime, Dashboard, Cycles, Trees, and Export routers.
- Live database validation: **PASS**
  - `harvest_records = 29106`
  - `harvest_cycles = 19`
  - `well_water_wells = 2`
  - `well_water_readings = 49`
  - `motor_runtime_entries = 23`
  - `beetle_trap_locations = 78`
  - `beetle_trap_counts = 81`
  - `beetle_trap_admin_settings = 2`
  - `inventory_products = 54`
  - `inventory_transactions = 47`
  - `harvest_records source='ODK' = 0`
- Controlled rollback tests: **PASS**
  - Motor Runtime → Irrigation calculation: `150 minutes = 2.5 hours = 125000 L`, Coconut `250 L/tree`, Nutmeg `200 L/tree`.
  - Inventory receipt + usage: Urea balance returned to `585 kg`; no test transactions remained.
  - Beetle Trap count: temporary Trap 1 count was visible inside transaction and removed by rollback.
- Coconut Harvest read-only checks: **PASS**
  - Cycle 19 remains Open, `2026-07-09` to `2026-07-15`.
  - Cycle 18 total from live records: `1482 records`, `2641 bunches`, `28302 nuts`.
  - Known tree check: Tree `1`, `18 records`, `435 nuts`, latest `2026-06-26`.
- Well Water read-only check: **PASS**
  - North Well latest examples calculate by approved depth formula.
  - South Well configuration warning remains a known follow-up item.
- Beetle read-only check: **PASS**
  - Top live traps since reset include Trap `75 = 10`, Trap `23 = 7`.
- Inventory backend source: **PASS with deployment required**
  - Inventory router and repaired `main.py` wiring are present in server deployment source.
  - Future API deploy must rebuild/restart `harvest-api`.
- Local route sweep: **NOT COMPLETED**
  - `next start` responded once for `/`, then exited in the Windows sandbox before route sweep. Production build still confirmed all app routes compile.
- Backup / merge / deploy / live smoke-test: **NOT DONE in this run**.

Do not mark the final backup, merge, deployment, or live smoke-test items complete until those steps are explicitly performed.

## 1. Code and PR readiness

- [ ] PR branch reviewed
- [ ] PR branch is up to date with GitHub
- [ ] No unrelated files included
- [ ] No database dumps included
- [ ] No backup archives included
- [ ] No tile/GeoTIFF/QGIS source files accidentally included
- [ ] `Dockerfile.preview` remains untracked unless intentionally approved
- [ ] Working tree reviewed
- [ ] Pending Beetle Trap changes committed/pushed if approved
- [ ] Build/type check completed
- [ ] PR #1 remains unmerged until acceptance test passes

## 2. Homepage

- [ ] Homepage opens
- [ ] Coconut Harvest tile opens
- [ ] Well Water tile opens
- [ ] Motor Runtime tile opens
- [ ] Irrigation Management tile opens
- [ ] Beetle Trap Monitoring tile opens
- [ ] Admin/User tiles still work if present
- [ ] No broken or missing main tiles

## 3. Coconut Harvest

- [ ] Coconut Harvest landing page opens
- [ ] Tree View loads live PostgreSQL tree history
- [ ] Cycle & Harvest View loads live cycle totals
- [ ] Tree Performance View loads live classifications
- [ ] Detailed Query loads real data with no mock fallback
- [ ] Known harvest cycle total verified
- [ ] Known tree harvest history verified
- [ ] Known tree classification verified
- [ ] Duplicate validation/protection confirmed
- [ ] Export to Excel / CSV tested

## 4. Well Water

- [ ] Well Water dashboard opens
- [ ] North Well readings display
- [ ] South Well readings display
- [ ] North Well capacity/conversion verified
- [ ] South Well configuration warning reviewed
- [ ] Well Settings Admin opens
- [ ] Manual Reading / Correction workflow checked
- [ ] No unintended ODK or schema changes

## 5. Motor Runtime

- [ ] Motor Runtime dashboard opens
- [ ] M1/M2/M3 tiles display correctly
- [ ] Date range controls work
- [ ] Daily Runtime Log displays correctly
- [ ] Plot-wise Water Pumped table displays
- [ ] Motor Runtime Admin opens
- [ ] Save validation checked
- [ ] Recent entries table checked

## 6. Irrigation Management

- [ ] Irrigation Management page opens
- [ ] Homepage tile links to `/irrigation-management`
- [ ] Five zones display:
  - [ ] P1E — Plot 1 East
  - [ ] P1W — Plot 1 West
  - [ ] P2E — Plot 2 East
  - [ ] P2W — Plot 2 West
  - [ ] JF — Jackfruit
- [ ] Motor runtime data feeds irrigation values
- [ ] Total water calculation verified
- [ ] Water per tree calculation verified
- [ ] Date filters checked
- [ ] No Phase 2 features accidentally added

## 7. Beetle Trap Monitoring

- [ ] Beetle Trap page opens
- [ ] Orthomosaic map loads
- [ ] Real trap markers display
- [ ] Trap numbers display
- [ ] Marker colors are correct
- [ ] Marker sizes use live count data
- [ ] Admin reset date is used
- [ ] Daily Beetle Count loads live data
- [ ] Admin page opens
- [ ] Pheromone reset save checked
- [ ] Trap type update checked
- [ ] Trap location update checked
- [ ] New trap save checked
- [ ] Beetle count-only cron confirmed

## 8. Admin Centre

- [ ] Admin Centre opens
- [ ] Beetle Trap Admin opens
- [ ] Motor Runtime Admin opens
- [ ] Harvest Cycle Admin opens
- [ ] Well Water Admin opens
- [ ] User Control placeholder opens
- [ ] No unauthorized public admin behavior introduced

## 9. PostgreSQL and data checks

- [ ] PostgreSQL container/service healthy
- [ ] `harvest_cycles` count verified
- [ ] `harvest_records` count verified
- [ ] `harvest_records source='ODK'` count verified
- [ ] `tree_master` count verified
- [ ] `well_water_wells` count verified
- [ ] `well_water_readings` count verified
- [ ] `motor_runtime_entries` count verified
- [ ] `beetle_trap_locations` count verified
- [ ] `beetle_trap_counts` count verified
- [ ] `beetle_trap_admin_settings` count verified
- [ ] No unexpected database row-count changes

## 10. ODK and sync

- [ ] ODK Central opens
- [ ] ODK containers/services healthy
- [ ] ODK forms still accessible
- [ ] No ODK form changes made
- [ ] No manual sync/import run unintentionally
- [ ] Beetle daily cron present
- [ ] Beetle daily cron imports count records only
- [ ] Cron log reviewed

## 11. Backups before merge/deploy

- [ ] PostgreSQL backup completed
- [ ] PostgreSQL backup checksum created
- [ ] Application/repository backup completed
- [ ] `.env` files backed up securely
- [ ] Deployment script backed up
- [ ] Crontab exported
- [ ] Backup files listed with paths and sizes
- [ ] Backup download commands prepared
- [ ] Backup restore notes reviewed

## 12. Merge and deployment readiness

- [ ] Rollback commit recorded
- [ ] Current live commit recorded
- [ ] Target release commit recorded
- [ ] Current live image recorded
- [ ] Target Docker image recorded
- [ ] Deployment script updated for target commit/image
- [ ] Deployment command reviewed
- [ ] Rollback command/process reviewed
- [ ] PR #1 approved for merge
- [ ] PR #1 merged only after acceptance test passes

## 13. Live smoke test after deploy

- [ ] Public homepage opens
- [ ] Public Coconut Harvest opens
- [ ] Public Well Water opens
- [ ] Public Motor Runtime opens
- [ ] Public Irrigation Management opens
- [ ] Public Beetle Trap Monitoring opens
- [ ] Public Farm Map opens
- [ ] Public Admin Centre opens
- [ ] ODK public URL opens
- [ ] Detailed Query returns real data
- [ ] Export buttons still work where expected
- [ ] No major browser console/server errors
- [ ] Live smoke test completed

## 14. Final release sign-off

- [ ] Acceptance test results recorded
- [ ] Backup paths recorded
- [ ] Deployment result recorded
- [ ] Running image recorded
- [ ] Working tree status recorded
- [ ] Known deferred items recorded
- [ ] Jackfruit remains deferred
- [ ] Release approved
