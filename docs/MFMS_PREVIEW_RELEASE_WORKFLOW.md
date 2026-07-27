# MFMS Preview Release Workflow

1. Switch to `preview-release` and update with `git pull --ff-only`.
2. Create one scoped `feature/preview-<purpose>` branch.
3. Make only the intended changes. Import approved v0 hunks only when required.
4. Declare every allowed path in `deploy/approved-change-scope.txt`.
5. Run unit, build, live-contract and route tests.
6. Run `scripts/verify-preview-deployment-candidate.sh`.
7. Build immutable images containing purpose, short SHA and timestamp.
8. Start isolated candidate containers with different names and ports on `mfms_server_uat`; never run schedulers or ODK imports.
9. Run candidate smoke and compatibility tests.
10. Create a pre-change checkpoint with exact image rollback commands.
11. Replace only the approved Preview service.
12. Run post-deployment smoke, live-contract and drift checks.
13. Update `deploy/preview-baseline.json`, append the ledger, and add a compatibility record only after success.
14. Retain the immediately previous verified images and rollback containers.
15. Report results and request approval before any Production workflow.

Production uses a separate `production-release` branch, approval, images, backup and regression process. Preview never deploys automatically to Production.
