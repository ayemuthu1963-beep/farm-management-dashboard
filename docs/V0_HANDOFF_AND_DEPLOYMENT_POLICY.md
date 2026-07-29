# v0 Handoff and Deployment Policy

v0 branches are design/source branches only. They must never be deployed directly, used as a Docker build checkout, rebased onto unrelated v0 work, or merged directly into `preview-release`. Coconut Counting and Irrigation work remain separate.

Authoritative frontend repository:

`https://github.com/ayemuthu1963-beep/farm-management-dashboard`

After the `preview-working-baseline-2026-07-29` tag is approved and created, v0
must import or branch from that repository and tag. A v0-generated replacement
project is not an approved deployment source.

Approved workflow:

1. v0 changes an isolated branch.
2. The user approves screenshots and layout.
3. Compare that branch with current GitHub `main`.
4. Transfer only approved files or individual hunks to a dedicated integration branch based on current GitHub `main`.
5. Review the complete diff; never use broad whole-file "ours" or "theirs" conflict resolution.
6. Run tests and deployment gates.
7. Merge the reviewed integration branch through a protected pull request into `main`; advance `preview-release` only through the documented release workflow.
8. Build immutable candidate images and smoke-test them before public replacement.

Direct deployment from `v0/*`, feature, repair, detached-HEAD, or dirty worktrees is prohibited.

The authoritative backend deployment source is `ayemuthu1963-beep/muthu-harvest-dashboard` on `preview-release`. The related `ayemuthu1963-beep/mfms-backend` repository has a different legacy history and must not be substituted, merged, or used as the Preview deployment baseline.
