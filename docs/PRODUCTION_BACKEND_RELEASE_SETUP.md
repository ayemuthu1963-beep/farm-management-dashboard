# Production backend release control

The Production backend release is manual, immutable, and source-only. It is
never triggered by a push, pull request, Vercel deployment, v0, or a schedule.

## Required one-time setup

1. Install `scripts/production-server-backend-deploy.sh` on the server as
   `/home/muthu/.local/libexec/mfms-production-backend-deploy`, owned by
   `muthu`, mode `0700`. Install its companion
   `scripts/production-backend-rollback-record.py` as
   `/home/muthu/.local/libexec/mfms-production-backend-rollback-record.py`,
   also `muthu:muthu`, mode `0700`. Both files must come from the same reviewed
   commit; retain their previous bytes and checksums before replacing them.
2. Create a dedicated read-only checkout at
   `/home/muthu/muthu-harvest-dashboard-production-release`, fixed to the
   backend repository's `production-release` branch.
3. Create a dedicated Ed25519 deploy key. Its only server authorization is a
   forced command invoking `/home/muthu/.local/libexec/mfms-production-backend-deploy`;
   disable agent, port, X11, and PTY forwarding.
4. Store the private key and pinned known-host entry only in the GitHub
   `Production` environment as `PRODUCTION_BACKEND_DEPLOY_SSH_PRIVATE_KEY` and
   `PRODUCTION_SSH_KNOWN_HOSTS`. Set `PRODUCTION_SSH_HOST=168.144.179.221` and
   `PRODUCTION_SSH_USER=muthu` as environment variables.
5. Keep the Production environment's required reviewer enabled.

## Release sequence

1. Confirm the Production data-entry freeze.
2. Merge only a green backend PR into `production-release`.
3. Dispatch `Deploy Production backend` from trusted frontend `main` with the
   exact 40-character backend revision and confirmation
   `DEPLOY PRODUCTION BACKEND ONLY`.
4. Retain the verified custom-format database backup and sanitized Actions
   report. This release contract permits no database migrations.
5. Verify health, immutable version, required OpenAPI routes, input endpoint
   behavior, server logs, and unchanged frontend/Test/Preview identities.
6. End the freeze only after verification passes. If verification fails after
   the switch, dispatch `Roll back Production backend` using the currently
   deployed revision and confirmation `ROLL BACK PRODUCTION BACKEND`.

The deploy key cannot run a shell or target Test/Preview. The server gate
rejects non-head, non-descendant, unapproved-path, wrong-database, wrong-port,
wrong-network, wrong-mount, unlabelled, or migration-bearing candidates.

## Adjacent rollback records

Each forward deployment creates a random immutable deployment ID containing its
workflow run ID and UTC timestamp. Before the smoke candidate starts, the controller
atomically publishes an HMAC-signed preparation record containing the exact current
Production container, image, revision, environment hash and validated configuration.
The final replacement is created stopped. A second immutable signed record binds its
actual container ID to that preparation and the retained previous container before
the replacement starts. Successful activation atomically publishes the release state
referenced by that signed record.

Records live in the `0700` directory
`/home/muthu/.local/state/mfms-production-github/backend-rollback-records`; each record
is `0400`. The separate `0400` signing key is
`/home/muthu/.local/state/mfms-production-github/backend-rollback-signing.key`.
The key is generated locally and is never printed, included in Git, or copied into
reports. Missing signing material with existing records fails closed. Paths, file
types, ownership, permissions, duplicate JSON/state fields and signatures are checked.
The trust boundary is the protected deployment account; an attacker controlling that
account or root can already replace the forced command itself.

The existing deployment lock covers enrollment, deployment, dry-run and rollback.
Both rollback commands validate the same signed exact adjacent pair; callers cannot
select an arbitrary historical image. A stopped or unhealthy exact source remains
eligible after the workflow has exited. Its signed database identity and immutable
configuration must still match. Dry-run reports when database validation uses that
signed identity because the source is stopped or unavailable; actual rollback checks the retained
image's real database through the isolated candidate before the traffic switch, then
compares read-only database evidence before and after restoration. No rollback path
runs migrations or restores a database dump.

Rollback completion appends a signed receipt. Repeating the original request verifies
the restored container and retained source and returns an explicit already-complete
result, without reversing the restoration. Failed transactions restore the previous
state file and verify exact artifact/configuration/database/protected-service state
before reporting automatic restoration success. Separately approved later frontend
deployments remain possible: unrelated services are protected across each operation,
not frozen forever to their identity at the preceding backend deployment.

Only the current base mount policy is allowed by this prerequisite repair. A future
Intelligence release must explicitly add its approved read-only key mount policy;
the two adjacent records may then retain different individually validated mount sets.

## Installing the prerequisite repair and enrolling the current release

Use the established `muthu` administrative SSH session. Confirm fresh installed-file
checksums, live container/image/revision and retained rollback artifacts against the
review report. Acquire the existing `deployment.lock` before staging the two reviewed
files in `.local/libexec`; validate `bash -n` and Python compilation, apply ownership
and `0700` permissions, verify exact source checksums, then atomically rename each
staged file into its established path. Retain the original controller until the
enrollment and dry-run proofs pass. This installation must not start/stop containers,
dispatch an application deployment or invoke an actual rollback.

For the existing unsigned state only, resolve the exact current revision and SHA-256
of `last-successful-backend-switch` immediately before enrollment. Invoke the installed
forced command with `SSH_ORIGINAL_COMMAND` set to:

```
enroll-production-backend-rollback CURRENT_REVISION EXACT_STATE_SHA256 RUN_ID
```

Enrollment takes the normal lock, verifies the fresh hash and both current and retained
artifacts, creates signed records and updates only protected local release state.
Existing enrolled state cannot be enrolled again. The same installed command then
accepts this read-only proof (using a new numeric audit run ID):

```
dry-run-production-backend-rollback CURRENT_REVISION RUN_ID
```

Require `PRODUCTION_BACKEND_ROLLBACK_DRY_RUN=PASS`, the exact adjacent identities, and
`traffic_switch=not-performed`. Run `tests/test_production_backend_rollback_record.py`
to prove the synthetic future pair, tamper rejection, stopped-source restoration,
post-workflow availability, repeated requests and lock behavior without using live
containers or production credentials. The existing CI workflow runs these tests through
`tests/production-backend-deployment-workflow.mjs`.

## Application-only Intelligence promotion

Select `deployment_mode=application-only` in the existing guarded Production backend
workflow. Its forced command is `deploy-production-backend-application-only SHA RUN_ID`.
The descriptor must declare `backend-application-only`, the
`production-intelligence-v1` runtime profile and the database invariant
`read-only-verification-only`. All 13 migration path/checksum entries must equal the
current deployed descriptor; database files and the migration runner cannot change.

This mode invokes the existing migration runner only with `--verify`. That runner
opens PostgreSQL with `default_transaction_read_only=on`, requires the existing ledger,
and rejects unapplied or checksum-mismatched entries. No backup, ledger creation or
migration application is invoked. The sanitized workflow report must confirm
`database_backup_operations=none`, `database_migration_operations=none` and
`database_migrations=read-only-verified` before declaring success.

The current environment is preserved except for build metadata and these approved
Intelligence settings: enabled=true, endpoint `http://10.122.0.3:8765`, service identity
`mfms-production-backend`, and key file `/run/secrets/mfms_intelligence_production_key`.
The dedicated host key is `/home/muthu/.local/state/mfms-production-intelligence/production_service_key`,
owned by muthu, regular, non-symlink, single-link and mode 0400 inside a 0700 directory.
It is mounted read-only. Provisioning and distributing its value is a separate guarded
operation; never put it in a workflow parameter, repository, log or report.

Signed rollback records retain each exact mount/environment profile. A new Intelligence
backend can roll back to its adjacent legacy base backend without the Intelligence
mount; smoke containers use the retained target's profile. Keep the dedicated key while
any signed retained artifact references it. A mode/profile downgrade cannot substitute
for the recorded source or target. Existing deployment locking, staged signed records,
private key integrity, fixed-IP recovery and protected-service comparison remain active.
