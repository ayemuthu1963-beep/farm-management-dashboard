# v0 Handoff and Deployment Policy

v0 branches are design/source branches only. They must never be deployed directly, used as a Docker build checkout, rebased onto unrelated v0 work, or merged directly into `preview-release`. Coconut Counting and Irrigation work remain separate.

Approved workflow:

1. v0 changes an isolated branch.
2. The user approves screenshots and layout.
3. Compare that branch with `preview-release`.
4. Transfer only approved files or individual hunks to a dedicated integration branch based on `preview-release`.
5. Review the complete diff; never use broad whole-file “ours” or “theirs” conflict resolution.
6. Run tests and deployment gates.
7. Merge or fast-forward the reviewed integration branch into `preview-release`.
8. Build immutable candidate images and smoke-test them before public replacement.

Direct deployment from `v0/*`, feature, repair, detached-HEAD, or dirty worktrees is prohibited.
