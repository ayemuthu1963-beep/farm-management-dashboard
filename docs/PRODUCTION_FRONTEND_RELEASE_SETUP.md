# Production Frontend Release Control

The DigitalOcean Production frontend is promoted only by the manual GitHub
workflows `production-frontend-deploy.yml` and
`production-frontend-rollback.yml`. A Vercel deployment whose target is null
or Preview is not a DigitalOcean Production promotion.

The deploy workflow requires the owner-approved exact candidate SHA, the
exact revision currently running, the Production environment approval, and
the confirmation text `DEPLOY PRODUCTION FRONTEND ONLY`. It invokes the
server-side forced-command helper with a dedicated SSH identity. Neither
workflow has a push, pull-request, schedule, or workflow-run trigger.

Before switching the frontend, the helper verifies the named Production
service manifest (frontend, API, database, authentication, harvest counter,
and reverse proxy), while discovering and snapshotting every unrelated live
container dynamically. Missing, duplicate, stopped, unhealthy, restarted, or
changed protected services fail closed. The frontend transaction namespace—
the live container and the controller-generated `-candidate-` and `-pre-`
container prefixes—is excluded from the unrelated-service snapshot. The
helper also requires zero failed
systemd units, all three API health endpoints, environment-specific database
roles and database names, Production `harvest-api` ownership of `172.19.0.2`,
the `172.19.128.0/17` dynamic pool, the current Production frontend
image/revision, and retained rollback state.

Every future Production frontend candidate must be the exact
`production-release` head and contain `deploy/production-release-manifest.json`.
The manifest base must equal the currently running revision and its path list
must exactly equal the reviewed source diff. Environment, Compose, migration,
workflow, deployment-helper, and other infrastructure paths are rejected.

The dedicated public key must be installed for user `muthu` with the forced
command `/home/muthu/.local/bin/deploy-production-frontend` and SSH
forwarding, PTY, and user-rc disabled. The corresponding private key is stored
only as the `PRODUCTION_FRONTEND_DEPLOY_SSH_PRIVATE_KEY` secret in the GitHub
Production environment. Host and known-host settings reuse the existing
approved Production environment values.

Creating or merging these control files does not execute the workflow. A
future Production promotion still requires the owner freeze gate and an
explicit manual workflow dispatch.
