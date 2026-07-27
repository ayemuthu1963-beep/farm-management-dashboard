# MFMS Backend Release Workflow

1. Use `ayemuthu1963-beep/muthu-harvest-dashboard` as the authoritative backend repository.
2. Begin integration work from `preview-release`; never substitute the unrelated `mfms-backend` history.
3. Require a clean worktree, an attached branch, and passing ancestry and scope gates.
4. Push reviewed integration commits to `origin/preview-release` without force.
5. Verify local and remote heads and require ahead/behind `0/0` before a deployment candidate is built.
6. Keep `main`, repair branches, and milestone tags pending separate review unless explicitly approved.
7. Build and test isolated candidate containers before any public Preview replacement.
8. Keep the deployed application commit and image identity separate from later governance-only commits.

The preserved Detailed Query backend baseline archive is stored outside Git at `C:\MFMS_LOCAL\backups\backend-source-baselines\dq-backend-baseline-source.tar.gz`.
