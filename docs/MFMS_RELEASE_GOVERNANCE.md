# MFMS release governance

This is the controlling workflow for the MuthuFarms frontend and backend repositories. It preserves the current live Production application and database until a separately approved Production release is made.

## Authoritative sources

- Frontend: `ayemuthu1963-beep/farm-management-dashboard`
- Backend: `ayemuthu1963-beep/muthu-harvest-dashboard`
- Stable local checkouts: `Documents/Codex/MuthuFarms/frontend` and `Documents/Codex/MuthuFarms/backend`
- GitHub is the source of record. Codex works on scoped branches and Vercel supplies disposable browser-test deployments. The three `muthufarms.com` sites remain server-hosted and are not Vercel custom domains.

## Release lines

| Branch | Purpose | Direct server deployment |
|---|---|---|
| `feature/*`, `fix/*`, `hotfix/*` | One scoped change and its Vercel preview | Prohibited |
| `test-release` | Exact Test candidate/baseline | Only through the guarded Test workflow |
| `preview-release` | Exact Preview candidate/baseline | Only through the guarded Preview workflow |
| `production-release` | Exact live Production baseline or approved candidate | Prohibited while the Production freeze is active |
| `main` | Trusted governance and automation source during branch reconciliation | Never a reason by itself to change `muthufarms.com` |

The baseline tags are immutable evidence. Never move or recreate an existing baseline tag.

## Promotion by change class

### Minor correction

1. Branch from the release line that currently contains the affected code.
2. Open a pull request and require CI, diff review, a Vercel preview, and a rollback commit.
3. Validate on Test or Preview. A cosmetic correction may skip a long Test soak, but it must not skip a non-Production deployment and smoke test.
4. Promote the same tested commit through the protected release lines.
5. Obtain Production approval and verify the read-only preflight before any Production action.

### Major or new-page change

1. Develop on a scoped branch and test the Vercel deployment.
2. Promote the exact commit to Test and complete functional, role, mobile, and regression checks.
3. Promote the same reviewed change to Preview and complete user acceptance.
4. Create a Production release record containing exact frontend/backend commits, evidence, rollback, and approval.
5. Deploy only in an approved window. Never edit the live server directly.

### Database change

1. Use a new forward-only migration; never rewrite an applied migration.
2. Record the migration path and SHA-256 in the release descriptor and provide a tested rollback or forward-fix procedure.
3. Apply and verify on the isolated Test database first, then on `mfms_server_uat` in Preview.
4. Before Production, identify the exact live database read-only, capture and verify a fresh backup, rehearse restore, record row-count/schema baselines, and obtain separate approval.
5. Apply to Production once, under an advisory lock and exact database-name guard, then verify the ledger and acceptance checks. Until that approval, Production database access remains strictly read-only.

## Mandatory release proof

Every release record must contain:

- change classification and approved scope;
- exact frontend and backend 40-character commits;
- CI run and Vercel preview URL;
- Test and Preview evidence appropriate to risk;
- environment, database, ODK project, and role-boundary checks;
- migration checksums when applicable;
- backup hash and restore evidence for a Production database change;
- rollback commit/images and stop conditions;
- Production approver and maintenance window.

## Prohibitions

- No direct push to a protected release branch.
- No deployment from a dirty worktree, archived project, v0 replacement project, or unreviewed branch.
- No reuse of Preview/Test secrets for Production.
- No automatic promotion from Preview or Vercel to Production.
- No Production deployment, restart, configuration change, secret change, or database write during a Production freeze.

## Current transition rule

`main`, `preview-release`, and the live Production baseline have diverged. Do not merge them broadly. Reconcile them with reviewed, file-scoped pull requests after CI is present. The `production-release` branch and `production-baseline-20260808` tag preserve the known live baseline; they do not authorize a deployment.
