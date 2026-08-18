# MFMS Preview Release Workflow

1. Fetch `ayemuthu1963-beep/farm-management-dashboard`, switch to current protected `main`, and update with `git pull --ff-only`.
2. Create one scoped `feature/preview-<purpose>` branch.
3. Make only the intended changes. Import approved v0 hunks only when required.
4. Declare every allowed path in `deploy/approved-change-scope.txt`.
5. Run unit, build, live-contract and route tests.
6. Run `scripts/verify-preview-deployment-candidate.sh` and verify the deployed baseline commit is an ancestor of the candidate.
7. Build immutable images from a clean GitHub clone using `Dockerfile.preview`, `pnpm@10.34.5`, and `pnpm-lock.yaml`. Pass the exact commit and timestamp as image build arguments.
8. Start isolated candidate containers with different names and ports on `mfms_server_uat`; never run schedulers or ODK imports.
9. Run candidate smoke and compatibility tests.
10. Create a pre-change checkpoint with exact image rollback commands.
11. Replace only the approved Preview service.
12. Run post-deployment smoke, live-contract and drift checks.
13. Verify `/api/version` reports the same commit as the image label and GitHub release source.
14. Update `deploy/preview-baseline.json`, append the ledger, and add a compatibility record only after success.
15. Retain the immediately previous verified images and rollback containers.
16. Report results and request approval before any Production workflow.

## Vercel callback timing

Keep the protected `validate` and `Vercel` required checks unchanged. A Vercel
deployment reaching `READY` is not, by itself, evidence that its genuine GitHub
callback is missing. If the exact commit does not yet show the Vercel GitHub App
status, allow at least 15 minutes from the deployment's `READY` timestamp before
classifying the callback as missing or escalating the integration. During that
window, do not create a replacement check, write a synthetic commit status,
redeploy merely to retrigger the callback, add a token-based proof workflow, or
alter branch protection. Merge only after the genuine `Vercel` status is attached
to the exact PR head SHA and is successful.

Production uses a separate `production-release` branch, approval, images, backup and regression process. Preview never deploys automatically to Production.
