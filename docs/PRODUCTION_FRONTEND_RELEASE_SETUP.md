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
container dynamically. Each protected snapshot is built from fresh container
inspection and includes the container ID, name, image, running state, restart
count, explicit `healthy` or `no-healthcheck` state, network mode, and port
bindings. Missing, added, duplicate, stopped, restarted, unhealthy, malformed,
uninspectable, or otherwise changed protected services fail closed. A
configured health check must report `healthy`; an actual no-healthcheck
container is supported only while it remains running and explicitly retains
that state. The immediate post-switch snapshot and a second fresh snapshot
after the controller's 600-second observation must both equal the pre-switch
snapshot before the deployment transaction can report success. The replacement
frontend's version, route smoke tests, public authentication guard, and zero
restart count are also revalidated after that observation. The frontend transaction
namespace—the live container and the controller-generated `-candidate-` and
`-pre-` container prefixes—is excluded from the unrelated-service snapshot and
continues through its dedicated target, candidate, and rollback gates. The
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

## Signed rollback after the deployment workflow completes

Install the reviewed controller at `/home/muthu/.local/bin/deploy-production-frontend`
and its dedicated companion at
`/home/muthu/.local/libexec/mfms-production-frontend-rollback-record.py`, preserving
owner muthu and mode 0700. Keep exact backups and compare all container, routing,
release-state and existing backend signing-record state before and after installation.
No container is switched by installation. Frontend records and its signing key use
separate `frontend-rollback-records` and `frontend-rollback-signing.key` paths in the
existing protected Production state directory; do not reuse the backend signing key.

The one-time forced command `enroll-production-frontend-rollback CURRENT_SHA STATE_SHA256 RUN_ID`
requires fresh exact current and retained image/container/revision metadata and the
unchanged unsigned frontend state hash. It signs the existing adjacent pair without
changing traffic. Never enroll an already signed state. The read-only command
`dry-run-production-frontend-rollback CURRENT_SHA RUN_ID` verifies the signed pair,
protected services and exact network identity without Docker mutation.

Every future deployment records its previous live artifact before starting its smoke
candidate and binds the final replacement container before starting it. Successful
activation commits the signed record. Explicit rollback checks the same record even
when the source has stopped, restarted or lost its runtime address; wrong nonempty
addresses, configuration, image or identity still reject. The restored target must be
running and pass the existing local/public acceptance and protected-service checks.
A signed receipt makes repeated rollback a verified no-op, never a reverse switch.

Automatic restoration verifies the exact source, signed state and preserved target.
A retained-target naming collision refuses recovery without deleting that artifact.
Keep all recorded targets and signing files until a separately reviewed retention
operation establishes they are no longer rollback dependencies. The hermetic tests
exercise stopped-source rollback, signature tampering, mismatched configuration,
protected-service drift and immutable activation order; no actual Production rollback
is part of commissioning this repair.
