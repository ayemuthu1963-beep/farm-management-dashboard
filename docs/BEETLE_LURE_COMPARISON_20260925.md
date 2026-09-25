# Beetle lure company comparison

Prepared against production frontend `33e92bbd9c3427337d7beb0386326721a50c70ea`.

## Owner-approved behavior

- One chart with eight series, ordered Plot 1 G weevil/rhinoceros, Plot 2 G weevil/rhinoceros, Plot 1 B weevil/rhinoceros, Plot 2 B weevil/rhinoceros. Plot 1 is solid; Plot 2 is dashed. Four colors distinguish company/species pairs.
- B/G lures were installed on 24 September 2026. Exclude earlier catches. Honor a later active reset date if one is configured.
- Area rows: Plot 1 B, Plot 1 G, Plot 2 B, Plot 2 G. Preserve species-specific totals and per-installed-trap averages.
- Top 10 and Show all traps display the company after each trap number. Map popup titles/tooltips also show the company.
- Add B/G immediately below Trap No. in the trap matrix and its Excel export. Daily data and its export have the same eight series as the chart.

## Authoritative mapping

Company assignments: owner-supplied `beetle-in-traps-2026-09-21 (1)(2).xlsx`, SHA-256 `a123dcdab5c11397c0cc6a2ea7ce5e0733e49a6e6026c6ac8a350fac7fa4c483`.

All 78 Excel trap IDs and font-color species were reconciled to the production backend's approved daily plot mapping in `api/app/routers/beetle_trap.py`, blob `da45e443b9d347fe4bd6a3d81753c289cc4d3923`, read from `muthu-harvest-dashboard/production-release`. Plot is not inferred from odd/even numbering or recalculated from GPS.

| Group | Red Palm Weevil traps | Rhinoceros Beetle traps |
| --- | ---: | ---: |
| Plot 1 B | 10 | 9 |
| Plot 1 G | 10 | 7 |
| Plot 2 B | 10 | 11 |
| Plot 2 G | 9 | 12 |

Total B: 40; total G: 38. The source workbook itself is not published in this repository.

## Calculation and failure behavior

The existing authenticated locations API provides individual ODK-synced inspection records for the active reset period. The frontend applies the installation-date boundary and aggregates those records using one shared plot/company/species mapping. No backend deployment, database migration, ODK form edit or catch-data write is needed.

Recorded zero counts remain zero in the daily comparison. No observation is represented as null/gap, not an invented zero. Multiple records on the same date are summed. Area averages divide recorded catches by installed traps in the matching group; they are not catches per inspection. The UI explains that inspection coverage and dates must be comparable. The existing trap matrix continues to show blank zero/missing cells.

The comparison refuses unmapped traps, duplicates, changed species, incomplete active inventory, unavailable inspection records and invalid counts. A new/reassigned trap requires a reviewed mapping update. Current assignments should not be assumed valid for a future company change; that needs a new effective-dated mapping.

## Verification completed

- All 78 resolved workbook IDs, B/G assignments and species checked against the source and approved backend plot mapping.
- New executable calculation tests cover all eight groups, unequal denominators, daily/area/matrix reconciliation, installation and end-date boundaries, later reset dates, zero-only dates, missing counts, duplicate records, mapping failure cases, and both Excel exports.
- `pnpm test`: PASS, including the existing application regression suite and new comparison tests.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS.
- Built `/beetle-trap` and `/api/beetle-trap/markers` exercised against an isolated synthetic API: PASS. Four company area rows and the B/G matrix row rendered; 78 markers returned; pre-installation records of 999 catches were excluded.
- `git diff --check`: PASS.

## Remaining release checks

Not deployed. No production data or sessions were changed. The branch has an exact `vercel.json` deployment exclusion from its first published commit.

Browser automation failed to start in the execution environment, so desktop/mobile visual verification is outstanding. Synthetic server-rendering checks do not substitute for live ODK verification.

Continue from the server-connected Codex environment:

1. Review the pull request diff against the current production revision; reconcile any intervening changes.
2. Verify the production locations response contains all 78 expected active traps, the reset date is 24 September 2026, and the grouped daily sums reconcile with current ODK-synced counts.
3. Check desktop/mobile chart legends, four solid/four dashed lines, water/reset markers, Top 10/Show all labels, B/G matrix row, and both downloads using an isolated candidate.
4. Use the established production release process and immutable candidate checks. Preserve active sessions and retain the current frontend image for rollback. Follow the existing post-deployment observation gate.

Do not deploy this feature branch directly or substitute the older default `main` branch for `production-release`.
