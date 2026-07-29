# Preview to GitHub Reconciliation Audit

Generated: 2026-07-29 (Asia/Kolkata)

## Compared States

- **A — Running Preview build/source:** image `mfms-v0-preview:farm-map-autocomplete-225c3c6-20260729-105656`, image ID `sha256:3ceda790a8726eb52f21d107d8f0c1e1bd962823d861ccab6b6e5730856dfcac`, retained context `/home/muthu/mfms-builds/farm-map-autocomplete-2684d03-20260729-104743`.
- **B — Server frontend working tree:** `/home/muthu/mfms-v0-preview`, detached at `5fe26d4`, with untracked `Dockerfile.preview`.
- **C — GitHub frontend main before reconciliation:** `ayemuthu1963-beep/farm-management-dashboard@5fe26d4b753e22330e399bdf9ea738ac92de81ec`.
- **Verified deployed application commit:** `225c3c6d1742fab5852a1d520ba3076cb145ada6`.

The retained running build and commit `225c3c6` are semantically identical after
normalising CRLF/LF line endings. The only extra source-like file in the build context
is the server-only `Dockerfile.preview`. Runtime-only `candidate.env`,
`source.tar`, and `tsconfig.tsbuildinfo` were excluded and will not be committed.

The server working tree and GitHub main are likewise semantically identical after
line-ending normalisation, apart from the same untracked Dockerfile. Therefore the
authoritative application reconciliation is a safe fast-forward from GitHub main to
the already deployed `preview-release` history.

## Summary

- Files differing between deployed Preview commit and GitHub main: **118**
- GitHub main is an ancestor of the deployed Preview commit: **Yes**
- Uncommitted application files in the deployed source: **None**
- Server-only untracked file: **Dockerfile.preview**
- Secrets selected for commit: **None**
- Large orthomosaic/tile directories selected for commit: **None**
- Small required coconut-tree GeoJSON files: Plot 1 and Plot 2 only

## File-by-File Differences

Checksums are the first 12 characters of SHA-256. Server and build-context values may
differ from Git blob values only because the retained server copies use CRLF line
endings; semantic comparison used `diff --strip-trailing-cr`.

| File path | Present in Preview / checksum | Present in server / checksum | Present in GitHub main / checksum | Recommended authoritative version | Reason |
|---|---|---|---|---|---|
| `.gitignore` | Yes `4bf12823283f` | Yes `3ee4a17710ae` | Yes `20a0d2251f9f` | Current Preview (`225c3c6`) | Dependency/build metadata required by the approved Preview source. |
| `app/admin/beetle-trap/page.tsx` | Yes `013c5942f470` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `app/admin/harvest-cycle/page.tsx` | Yes `068dd4622253` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `app/admin/harvest-sync/page.tsx` | Yes `6ac4612faef8` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `app/admin/harvest/page.tsx` | Yes `8f432eff8ce5` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `app/admin/motor-runtime/page.tsx` | Yes `11b41a868569` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `app/admin/page.tsx` | Yes `0941413687da` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `app/admin/well-water/page.tsx` | Yes `82cb99135596` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `app/api/admin/beetle-trap/counts/route.ts` | Yes `de43f88989ca` | No — | No — | Current Preview (`225c3c6`) | Approved Beetle Trap data, chart, map, and Admin behaviour. |
| `app/api/admin/harvest-cycle/close/route.ts` | Yes `9c46816dcc7a` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `app/api/admin/harvest-cycle/open/route.ts` | Yes `022be06b495e` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `app/api/admin/harvest-cycle/sale-details/route.ts` | Yes `1dda5a34e6e4` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `app/api/admin/harvest-sync/[[...path]]/route.ts` | Yes `0277dc41d9f3` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `app/api/admin/harvest/records/route.ts` | Yes `e4b8a685b67c` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `app/api/admin/motor-runtime/entries/route.ts` | Yes `26524e694872` | No — | No — | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `app/api/admin/well-water/readings/route.ts` | Yes `6cfcad94ada7` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `app/api/coconut-harvest/cycle-details/route.ts` | Yes `32aa107c52b1` | No — | No — | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `app/api/coconut-harvest/detailed-query/route.ts` | Yes `6682f0047055` | Yes `fdae2efb0ba3` | Yes `c1060ae24b2d` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `app/api/coconut-harvest/tree-master/route.ts` | Yes `c7c4fe70c65c` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `app/api/farm-map/trees/[treeNo]/harvest-summary/route.ts` | Yes `697435417708` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `app/api/fertiliser/[...path]/route.ts` | Yes `8424a036183d` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `app/api/fertiliser/export/products/route.ts` | Yes `ebf7d396599c` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `app/api/fertiliser/export/requirements/route.ts` | Yes `b4ff0ece8cad` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `app/api/fertiliser/export/stock/route.ts` | Yes `01305e0f55c7` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `app/api/fertiliser/export/transactions/route.ts` | Yes `12c0866c3923` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `app/api/fertiliser/proxy.ts` | Yes `05ba3848c7ca` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `app/api/irrigation-management/route.ts` | Yes `de97b474aabf` | Yes `ee2f6ae8f18c` | Yes `a25d3a9e21b6` | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `app/api/motor-runtime/dashboard/route.ts` | Yes `e5ec52c2eeda` | No — | No — | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `app/api/well-water/dashboard/route.ts` | Yes `b02899b0b649` | Yes `4624dcc5a237` | Yes `11661a6ddcb7` | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `app/beetle-trap/page.tsx` | Yes `7c8cf11572fe` | Yes `cd11972c277b` | Yes `158033108252` | Current Preview (`225c3c6`) | Approved Beetle Trap data, chart, map, and Admin behaviour. |
| `app/coconut-harvest/cycle-view/page.tsx` | Yes `ea3d88e34326` | Yes `f0e88086caa8` | Yes `f847c21fb52b` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `app/coconut-harvest/detailed-query/page.tsx` | Yes `e2a612f2ea60` | Yes `fd9c27855e1e` | Yes `d55f28109496` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `app/coconut-harvest/loading.tsx` | Yes `31c2b66cde5e` | No — | No — | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `app/coconut-harvest/tree-performance/page.tsx` | Yes `e16e73615bfe` | Yes `81e6e6ea6371` | Yes `911913570b56` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `app/coconut-harvest/tree-view/page.tsx` | Yes `b7dea920cd58` | Yes `9aaab64c6527` | Yes `1e600ea5b15f` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `app/farm-map/page.tsx` | Yes `86f36c775925` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `app/fertiliser-management/page.tsx` | Yes `b32529d295d7` | Yes `725a23f574b1` | Yes `381adb068223` | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `app/irrigation-management/page.tsx` | Yes `4c70311c1a23` | Yes `bfcb1bc5b6dc` | Yes `b819e0d632f9` | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `app/layout.tsx` | Yes `44cdef036c9d` | Yes `43800a1f5018` | Yes `b33d6ef772ff` | Current Preview (`225c3c6`) | Approved 15-tile homepage and shared sidebar navigation baseline. |
| `app/map-tiles/farm-combined-png/[z]/[x]/[y]/route.ts` | Yes `42b092f7e8bf` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `app/motor-runtime/page.tsx` | Yes `8141821c5c15` | Yes `a5d0efd41e9f` | Yes `5075e1d88752` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `app/well-water/page.tsx` | Yes `e8ee20597ca1` | Yes `d5061108def9` | Yes `4eebf0b55202` | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `components/admin/beetle-trap-entry-client.tsx` | Yes `45705837e543` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `components/admin/harvest-cycle-admin-client.tsx` | Yes `8e00f3a040e7` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `components/admin/harvest-entry-client.tsx` | Yes `020eec219f8f` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `components/admin/harvest-sync-admin-client.tsx` | Yes `38db75a75c11` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `components/admin/motor-runtime-entry-client.tsx` | Yes `25de3cd973b5` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `components/admin/preview-admin-notice.tsx` | Yes `359fff891e32` | No — | No — | Current Preview (`225c3c6`) | Approved Admin Console, controlled data-entry, cycle, and manual-sync behaviour. |
| `components/admin/well-water-entry-client.tsx` | Yes `5f021f462483` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `components/beetle/beetle-chart.tsx` | Yes `4ae92df58095` | No — | No — | Current Preview (`225c3c6`) | Approved Beetle Trap data, chart, map, and Admin behaviour. |
| `components/coconut/coconut-subheader.tsx` | Yes `48309a9ffd88` | Yes `d34b02a086a1` | Yes `a5f40a5f2014` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `components/coconut/harvest-request-state.tsx` | Yes `68f3aa4ea663` | No — | No — | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `components/coconut/tree-view-client.tsx` | Yes `9c057f20ced4` | Yes `ce1f523c89b9` | Yes `f11c33e0857f` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `components/farm/dashboard-shell.tsx` | Yes `a4ef43c5b176` | Yes `02952752751c` | Yes `a3d587a8a3fc` | Current Preview (`225c3c6`) | Approved 15-tile homepage and shared sidebar navigation baseline. |
| `components/farm/date-range-selector.tsx` | Yes `b1f8426873c7` | Yes `7e8b663ae93d` | Yes `554d08520d06` | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `components/farm/local-environment-banner.tsx` | Yes `362fb0449a32` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `components/farm/sidebar.tsx` | Yes `a9c1f8024323` | Yes `34306eda84a7` | Yes `dfc639b36135` | Current Preview (`225c3c6`) | Approved 15-tile homepage and shared sidebar navigation baseline. |
| `components/farm/summary-cards.tsx` | Yes `485ddb35f8f4` | Yes `615aaacbe806` | Yes `a5a2c22f4f2e` | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `components/farm/well-chart.tsx` | Yes `9bf16a3ce27e` | Yes `68bfd598c70b` | Yes `bd6c72a37614` | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `components/farm/well-table.tsx` | Yes `a3b4e4c90b20` | Yes `85be9bb5c51b` | Yes `5de6a2e602d3` | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `components/harvest/tree-number-autocomplete.tsx` | Yes `0d96d23e6617` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `components/irrigation/irrigation-charts-hybrid.tsx` | Yes `2f589755d9ae` | No — | No — | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `components/irrigation/irrigation-map-with-details.tsx` | Yes `e3efb249da0b` | No — | No — | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `components/irrigation/irrigation-period-selector.tsx` | Yes `b1eccf6e8b97` | Yes `b4f5c75a2b7a` | Yes `45d9434cfe70` | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `components/irrigation/irrigation-summary-cards.tsx` | Yes `81453b2bee28` | No — | No — | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `components/irrigation/irrigation-zone-table-hybrid.tsx` | Yes `3f31dc979c1b` | No — | No — | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `components/irrigation/zone-status-cards.tsx` | Yes `e4ef49eb0c7b` | No — | No — | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `components/maps/farm-map-client.tsx` | Yes `55997cd4d999` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `components/maps/farm-orthomosaic-map.tsx` | Yes `14c8857e25f8` | Yes `15ad56aa5c62` | Yes `5c4909a54a10` | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `components/motor/motor-chart.tsx` | Yes `564fc25e4f37` | Yes `e82e2e149044` | Yes `84d755471748` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `components/motor/motor-date-range-selector.tsx` | Yes `292a56c5c6cd` | No — | No — | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `components/motor/motor-log-section.tsx` | Yes `65a30185e726` | Yes `beba0d5e710b` | Yes `354c2c443b3c` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `components/motor/motor-status-cards.tsx` | Yes `69476ca7eed0` | Yes `1da72c19f25a` | Yes `9bc8764840f1` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `components/motor/motor-summary-cards.tsx` | Yes `e343159dc9f9` | Yes `a241c6f927c2` | Yes `f29ce3e8bf75` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `components/motor/motor-table.tsx` | Yes `48ec3bd66976` | Yes `79a6134167fb` | Yes `99239540166d` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `components/motor/motor-valves-section.tsx` | Yes `1cda2d7c23e9` | Yes `afa76aa4824b` | Yes `6c237ec41678` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `deploy/CURRENT_CONFIGURATION_AUDIT.md` | Yes `8505ab1f04d8` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/PREVIEW_DEPLOYMENT_LEDGER.md` | Yes `9b9dc47f29ea` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/REPOSITORY_INVENTORY.md` | Yes `c3213af6294a` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/approved-change-scope.txt` | Yes `ff832559179e` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-baseline.json` | Yes `c531e7d3e475` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-release-20260727-201952.json` | Yes `6027def9378f` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-release-20260728-0830.json` | Yes `2c59013c46a7` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-release-20260728-0850.json` | Yes `eb0466ce25d9` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-release-20260728-0940.json` | Yes `115657d36080` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-release-20260728-1010.json` | Yes `8d3083e0c51f` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-release-20260728-1050.json` | Yes `bfd79447c982` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/preview-schedules.txt` | Yes `f355b0b40f94` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `deploy/root-crontab-verification.txt` | Yes `f835cac18264` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `docs/MFMS_BACKEND_RELEASE_WORKFLOW.md` | Yes `fa04d9207281` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `docs/MFMS_PREVIEW_RELEASE_WORKFLOW.md` | Yes `f61111cf89bd` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `docs/V0_HANDOFF_AND_DEPLOYMENT_POLICY.md` | Yes `4783ab3b1e94` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `lib/coconut-harvest-api.ts` | Yes `9ec67569bdd6` | Yes `f5eeae342a2e` | Yes `83ca112826bf` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `lib/coconut-harvest-data.ts` | Yes `77e38e1564d9` | Yes `a405ec25200a` | Yes `83d094d707dc` | Current Preview (`225c3c6`) | Approved Coconut Harvest pages, open-cycle handling, query recovery, Tree View, and performance behaviour. |
| `lib/fertiliser-api.ts` | Yes `3bccddd2c833` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `lib/fertiliser-data.ts` | Yes `0b220033e9c7` | Yes `34326438d3da` | Yes `4732e187fd04` | Current Preview (`225c3c6`) | Approved Preview Fertiliser data/API repair. |
| `lib/home-data.ts` | Yes `16fd73b39185` | Yes `67fbf8d8cc5e` | Yes `ab314c84fc52` | Current Preview (`225c3c6`) | Approved 15-tile homepage and shared sidebar navigation baseline. |
| `lib/irrigation-data.ts` | Yes `5bad011a3541` | Yes `b4ae1c1ed2b7` | Yes `c8d530f8f914` | Current Preview (`225c3c6`) | Approved Irrigation Management layout, zone, period, and live-data behaviour. |
| `lib/mfms-navigation.ts` | Yes `1965ef581ac6` | No — | No — | Current Preview (`225c3c6`) | Approved 15-tile homepage and shared sidebar navigation baseline. |
| `lib/motor-data.ts` | Yes `652f681b5bb9` | Yes `6663bc624bfb` | Yes `c3fcb868bcaf` | Current Preview (`225c3c6`) | Approved Motor Runtime query, summary, table, and date-range behaviour. |
| `lib/tree-number-options.ts` | Yes `1ebd1edfba49` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `lib/well-data.ts` | Yes `3c86cc525fa2` | Yes `14c25727544b` | Yes `ce7dee75fe9f` | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `next-env.d.ts` | Yes `4e4da12aa061` | No — | No — | Current Preview (`225c3c6`) | Dependency/build metadata required by the approved Preview source. |
| `package.json` | Yes `f122df94729c` | Yes `6f2363d18679` | Yes `50396ae259c9` | Current Preview (`225c3c6`) | Dependency/build metadata required by the approved Preview source. |
| `public/map-data/vector/plot1-coconut-trees-v1.geojson` | Yes `b1cb7a0c87a0` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `public/map-data/vector/plot2-coconut-trees-v1.geojson` | Yes `7dc4bd10349c` | No — | No — | Current Preview (`225c3c6`) | Part of the consolidated approved Preview application source. |
| `scripts/check-preview-config-drift.sh` | Yes `97953155363f` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `scripts/prepare-farm-map-trees.mjs` | Yes `fa63be902385` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `scripts/run-preview-candidate.sh` | Yes `6e46d272f80d` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `scripts/test-preview-live-contracts.sh` | Yes `89833681ac58` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `scripts/test-preview-release.sh` | Yes `8ce3bdb6b895` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `scripts/verify-preview-deployment-candidate.sh` | Yes `2aff77002cce` | No — | No — | Current Preview (`225c3c6`) | Approved Preview deployment-safety, configuration, smoke-test, and v0 handoff governance. |
| `tests/farm-map-coconut-trees.mjs` | Yes `f106a489a4ff` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `tests/navigation-consistency.mjs` | Yes `960a61077a4f` | No — | No — | Current Preview (`225c3c6`) | Automated regression coverage for the approved Preview behaviour. |
| `tests/preview-targeted-repair.mjs` | Yes `c1a9c30a17b5` | No — | No — | Current Preview (`225c3c6`) | Automated regression coverage for the approved Preview behaviour. |
| `tests/south-well-warning-regression.mjs` | No — | Yes `48726c6d7564` | Yes `faa5bffc59b8` | Current Preview (`225c3c6`) | Automated regression coverage for the approved Preview behaviour. |
| `tests/tree-number-autocomplete.mjs` | Yes `00c810109698` | No — | No — | Current Preview (`225c3c6`) | Approved Farm Map, independent tree layers, Harvest popup, and TREE MASTER autocomplete. |
| `tests/well-water-authoritative-daily-values.mjs` | Yes `3d8169eb9f73` | No — | No — | Current Preview (`225c3c6`) | Approved Preview Well Water calculations, display, loading, and daily-difference behaviour. |
| `Dockerfile.preview` | Yes `8f8c56c6be2a` | Yes `8f8c56c6be2a` (untracked) | No — | Sanitised tracked Dockerfile using `pnpm@10.34.5` | Removes the uncommitted server-only build dependency and makes clean-clone builds reproducible. |

## Package Manager Decision

- Authoritative package manager: **pnpm 10.34.5**
- Authoritative lockfile: **pnpm-lock.yaml**
- Evidence: `package.json#packageManager`, the only tracked lockfile, the successful
  typecheck/test/build workflow, and Corepack resolution to `pnpm 10.34.5`.
- Drift found: the untracked server Dockerfile used `npm install` without a
  `package-lock.json`.
- Reconciliation action: track a sanitised `Dockerfile.preview` that activates
  `pnpm@10.34.5` and installs with `--frozen-lockfile`.

## Security and Runtime Data

- Real environment files, credentials, tokens, keys, database dumps, checkpoints,
  build caches, `node_modules`, `.next`, and temporary archives are excluded.
- `.env.example` contains placeholders only.
- Existing orthomosaic tiles remain in the server data location and are not added.
- The two small versioned coconut-tree GeoJSON files remain because the deployed Farm
  Map requires them and they are already part of commit `225c3c6`.
