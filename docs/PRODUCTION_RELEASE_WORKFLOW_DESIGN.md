# Production release workflow design — credentials deliberately absent

This document is a reviewed design contract, not an active Production
deployment route. No Production SSH key, database credential, GitHub secret,
server program, scheduled job, or deployment workflow is installed by this
change.

## Preconditions before activation

Activation requires a new explicit Production maintenance approval. Before any
credential is installed, all of the following must be true:

1. The exact frontend and backend SHA has passed CI, Vercel, Test deployment and
   rollback, and Preview/UAT acceptance.
2. The `Production` GitHub environment has the owner as a required reviewer,
   prevents self-review where practical, has a wait timer, permits only trusted
   `main`, and does not permit administrator bypass.
3. Production uses a newly generated, Production-only forced-command SSH key.
   Test and Preview keys are forbidden.
4. The server-side forced command is independently reviewed, installed during
   an approved maintenance window, and accepts only exact lowercase 40-character
   SHAs plus the GitHub run ID.
5. A fresh encrypted backup and an independent disposable restore rehearsal are
   current, hashed, timed, and owned.

## Proposed workflow jobs

### 1. Authorize

- Runs from trusted `main` only.
- Requires exact frontend and backend SHAs, release ID, approved window, and the
  literal confirmation `DEPLOY APPROVED PRODUCTION RELEASE`.
- Resolves both SHAs against protected `production-release` heads and verifies
  that the accepted Test and Preview release records reference the same SHAs.
- Refuses moving tags, branch-only identities, dirty artifacts, missing CI,
  missing approval, or expired evidence.

### 2. Read-only preflight

- Reads current frontend/backend image digests, environment identity, exact
  database name, disk capacity, container health, TLS expiry, proxy target,
  scheduled-job digest, and rollback image availability.
- Database access uses a read-only role and `default_transaction_read_only=on`.
- Requires `mfms_server_prod`; any other or unknown identity stops the release.
- Creates no table, lock row, migration ledger, secret, file, container, or
  backup.

### 3. Backup gate

- Invokes a separately reviewed backup command only after owner approval.
- Produces encrypted local and off-host copies, SHA-256 hashes, byte counts,
  database/server identity, start/end time, and retention metadata.
- Restores the copy into an isolated disposable database and runs schema and
  representative read-only validation.
- Stops before deployment if backup, encryption, upload, hash comparison,
  restore, RPO, or RTO evidence is missing.

### 4. Guarded exact-artifact deployment

- Uses immutable image digests built from the already-tested SHAs; it does not
  rebuild from a working tree.
- Creates and verifies a candidate on isolated ports before switching traffic.
- Database migrations, when separately approved, are immutable, checksummed,
  ledgered, advisory-locked, exact-database guarded, and applied once.
- Records current and rollback image digests before any switch.

### 5. Post-deploy verification and stop conditions

- Verifies authenticated home, version identity, backend health, database
  identity, and representative read-only Weather, Harvest, Well Water, Motor,
  Fertiliser, and Worker paths.
- Confirms shared proxy, auth, ODK routes, schedules, and unrelated containers
  match their preflight digests unless explicitly in scope.
- Automatically stops and restores the prior application image on identity,
  health, authentication, database, proxy, or container-drift failure.
- Database rollback is never inferred. It follows the approved migration
  recovery plan and separate database authorization.

### 6. Separate rollback workflow

- Never runs automatically from a push or failed CI job.
- Requires the owner, exact currently running SHAs, release ID, rollback image
  digests, and literal confirmation `ROLL BACK APPROVED PRODUCTION RELEASE`.
- Restores only the immediately previous verified application images, then runs
  the same read-only identity and functional checks.

## Credential installation boundary

Until the user gives a new explicit Production maintenance approval:

- do not create the GitHub Production secrets;
- do not add a Production public key to `authorized_keys`;
- do not install a Production server-side deploy or rollback program;
- do not connect to the Production database; and
- do not dispatch a Production workflow.
