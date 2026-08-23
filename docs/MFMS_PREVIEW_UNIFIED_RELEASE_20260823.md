# MFMS Preview unified release 2026-08-23

Release-set ID: `MFMS-PREVIEW-AI-RECONCILED-20260823-R1`

This Preview-only release reconciles the verified deterministic AI Farm Analyzer with the newer governed Data Analyser Tool release. It does not authorize Production promotion, database migration, or disaster-recovery cleanup.

## Verified source bases

| Component | Reconstructable base | Included provenance |
| --- | --- | --- |
| Frontend | `415df4d211e03e28794b93ad788045b98527092f` | AI Analyzer PRs 222/224 through `b791546f0094118419b55186281f11cff2f93829`, then governed clarification compatibility |
| Preview backend/BFF | `425ccb70006623b94674081d663a0a31e73a2dd9` | deterministic Analyzer `058cdf22525a149d4a4bbc90aaea4a6338d0d462`, then governed clarification compatibility |
| Private Intelligence | `91bd618883082336ecebd898a56e4fb476f4b4fd` | immutable release `/opt/mfms-intelligence/releases/91bd618883082336ecebd898a56e4fb476f4b4fd` |

The final integration commit SHAs are recorded in the external deployment evidence after tests pass. The language model remains advisory; deterministic evidence is authoritative.

## Concurrent work disposition

- Frontend Plot migration `84a88d8b3a9cf8c2db12f0f964a0607882a2c7f6` is preserved but excluded. PR 223 is closed and the broad migration was deferred.
- Backend harvest/Analyzer Plot candidate `fee4fb7f67747fbce10d5f43c66eb283b2e9111a` is preserved but excluded. PR 71 remains open and Draft.
- No plot or database migration is declared ready by this release.
- Existing DR resources remain retained and untouched.

## Safety markers

```text
historical_production_touched=1
exception_accepted=1
exception_id=EXC-20260822-RESTORE-SMOKE-LIVE-POSTGRES
approved_sandbox_cleanup_touch=1
sandbox_cleanup_completed=1
post_cleanup_continuation_production_touched=0
PRODUCTION_PROMOTION_APPROVED=0
DR_RESOURCES_CLEANUP_APPROVED=0
```
