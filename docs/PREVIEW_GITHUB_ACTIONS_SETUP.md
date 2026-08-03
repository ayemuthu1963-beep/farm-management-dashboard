# Preview GitHub Actions Deployment Setup

This setup provides a guarded, automatic path from a reviewed Preview release to
the MFMS Preview server. It never targets Production. Preflight and rollback
remain deliberate manual operations.

## Safety boundary

- The only workflow allowed to read Preview server settings and SSH keys is the
  deploy workflow defined on trusted `main`.
- `preview-release` has an unprivileged `Preview release candidate` signal. It
  has read-only repository permission, no GitHub Environment, no SSH material,
  and does not run a server command.
- When that signal succeeds after a change to
  `deploy/preview-release-manifest.json`, GitHub starts the deploy workflow from
  `main` through `workflow_run`. The deploy workflow verifies the signal's exact
  commit is still the head of `preview-release` before it can access Preview
  secrets.
- The deploy workflow independently obtains the live Preview revision through
  the restricted read-only preflight identity. No person has to enter the live
  revision for an automatic or manual deployment.
- The jobs use the protected GitHub Environment named `Preview`. That
  environment must allow **only `main`**. Never add `preview-release` as a
  deployment branch; doing so would unnecessarily expose the environment to
  release-branch workflow definitions.
- GitHub permissions are read-only, and external Actions are pinned to full
  immutable commit hashes.
- SSH host verification is pinned; `ssh-keyscan` is not used by the workflow.
- Root SSH is prohibited. The approved remote account is `muthu`.
- The preflight identity can only inspect the current Preview containers and
  return a sanitized report. It cannot change server state.
- The deployment and rollback identity can invoke only a fixed server program;
  it cannot open a shell or select an arbitrary command.
- The server program accepts only the exact head of `preview-release`, verifies
  that it contains the current live Preview baseline, validates the candidate's
  manifest and changed-file scope, then builds it locally.
- The candidate is tested on `127.0.0.1:3016` before the live Preview frontend
  is switched. The live service remains `mfms-pilot-web` on `127.0.0.1:3015`
  and keeps its existing `harvest-net` address, so the shared proxy is not
  reloaded.
- The candidate port must be unused before the build begins. The deployment
  stops safely if another process has already bound `127.0.0.1:3016`.
- The public Preview endpoint is intentionally HTTP-auth protected. Deployment
  verifies the expected anonymous `401` boundary while candidate revision and
  route smoke tests run locally; no browser credential is stored or sent by
  GitHub.
- Any failed switch retries restoration of the original Preview network address,
  then re-tests the original frontend. The immediately previous frontend is
  retained for manual rollback.
- Environment values are never printed; only setting names appear in reports.
- Production, the backend, database, ODK imports, schedules, and proxy
  configuration are not modified.

## One-time GitHub Environment configuration

In `ayemuthu1963-beep/farm-management-dashboard`:

1. Open **Settings → Environments → Preview**.
2. Leave **Required reviewers** disabled for automatic Preview deployments.
3. Restrict deployment branches to **only `main`**.
4. Add these environment variables:
   - `PREVIEW_SSH_HOST`: the Preview server hostname or IP address.
   - `PREVIEW_SSH_USER`: `muthu`.
5. Add these environment secrets:
   - `PREVIEW_SSH_PRIVATE_KEY`: a dedicated, unencrypted SSH private key whose
     public key is restricted to the trusted Preview preflight command.
   - `PREVIEW_SSH_KNOWN_HOSTS`: the trusted `known_hosts` entry for the Preview
     server, copied from a computer that has already verified that server.
   - `PREVIEW_DEPLOY_SSH_PRIVATE_KEY`: a different, dedicated, unencrypted SSH
     private key whose public key is restricted to the fixed Preview deploy and
     rollback program. Store the complete value, including the `BEGIN` and `END`
     lines.

Never place any of these values in source control, workflow inputs, issue or pull
request comments, Actions logs, or ChatGPT messages.

## First health check

After the setup is merged to `main`:

1. Open **Actions → Preview server preflight → Run workflow**.
2. Select `main`.
3. Enter `INSPECT PREVIEW ONLY`.
4. Download the seven-day `preview-server-preflight-*` artifact.

The report must end with `READ_ONLY_PREFLIGHT=PASS`.

## Automatic Preview deployment

The release is intentionally split between two branches:

1. `main` contains the trusted deployment workflow and is the only branch that
   may use the `Preview` environment.
2. `preview-release` points to the exact reviewed application revision intended
   for Preview. Its only automatic job is an unprivileged candidate signal.

For a normal correction, Codex prepares the tested revision and promotes it to
`preview-release` with an updated `deploy/preview-release-manifest.json`. That
manifest change runs the unprivileged signal. If it succeeds, the trusted
`main` workflow resolves the exact release head and the exact live Preview
revision, then performs the guarded deployment.

The first release that uses this automation must also contain
`.github/workflows/preview-release-candidate.yml` and list that file in its
release manifest. Adding the signal alone does not deploy anything because the
signal runs only when the manifest changes. Later corrections use the same
mechanism without any extra user action.

A successful deployment report ends with `PREVIEW_DEPLOYMENT=PASS` and states
`production_touched=0`.

The manual workflow remains available only for recovery or an exceptional
reviewed release. It asks for the exact `preview-release` revision and
`DEPLOY PREVIEW ONLY`; it still discovers the live revision itself.

## Guarded rollback

Open **Actions → Roll back Preview frontend → Run workflow** on `main`. Enter
the exact 40-character revision currently running on Preview and
`ROLL BACK PREVIEW`. Rollback remains manual even when Preview deployment is
automatic; it restores only the immediately previous retained Preview frontend.
A successful report ends with `PREVIEW_ROLLBACK=PASS` and states
`production_touched=0`.

The frontend backend target remains the UAT database `mfms_server_uat`
throughout. The backend, databases, ODK operations, schedules, proxy
configuration, and every Production container are compared before and after each
transaction and must be unchanged.

## Preview backend releases

The backend has a separate restricted release key, workflow, migration policy,
and rollback state. It is intentionally not handled by the frontend-only
workflow. Follow [Preview Backend Release Setup](PREVIEW_BACKEND_RELEASE_SETUP.md)
for the one-time installation and every future Preview API/database release.
