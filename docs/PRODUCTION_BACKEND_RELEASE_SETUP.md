# Production backend release control

The Production backend release is manual, immutable, and source-only. It is
never triggered by a push, pull request, Vercel deployment, v0, or a schedule.

## Required one-time setup

1. Install `scripts/production-server-backend-deploy.sh` on the server as
   `/home/muthu/.local/libexec/mfms-production-backend-deploy`, owned by
   `muthu`, mode `0700`.
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
