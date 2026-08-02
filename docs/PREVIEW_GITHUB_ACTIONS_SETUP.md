# Preview GitHub Actions Deployment Setup

This setup creates a manual, Preview-only path from GitHub Actions to the MFMS
Preview server. It never targets Production. Inspection, deployment, and rollback
are separate manual workflows, and every server-changing job pauses at the
protected `Preview` environment for approval.

## Safety boundary

- All three workflows run only through `workflow_dispatch` from `main`.
- The exact confirmation texts are `INSPECT PREVIEW ONLY`,
  `DEPLOY PREVIEW ONLY`, and `ROLL BACK PREVIEW`.
- The jobs use the protected GitHub Environment named `Preview`.
- GitHub permissions are read-only, and external Actions are pinned to full
  immutable commit hashes.
- SSH host verification is pinned; `ssh-keyscan` is not used by the workflow.
- Root SSH is prohibited. The approved remote account is `muthu`.
- The preflight workflow only inspects the current Preview containers and returns
  a sanitized report. Its dedicated SSH key cannot change server state.
- Deployment and rollback use a second SSH key restricted to one fixed server
  program. The key cannot open a shell or select an arbitrary command.
- Deployment accepts only the exact head of `preview-release`, requires the live
  revision to be its ancestor, and validates the exact changed-file allowlist in
  `deploy/preview-release-manifest.json` before building anything.
- The candidate is tested on `127.0.0.1:3016` before the live Preview frontend is
  switched. The live service remains `mfms-pilot-web` on `127.0.0.1:3015` and
  retains its existing `harvest-net` address, so the shared proxy is not reloaded.
- Any failed switch automatically restores and re-tests the original Preview
  frontend. The immediately previous frontend is retained for the manual rollback
  workflow.
- Environment values are never printed; only environment variable names are
  included in the report.
- Production, the backend, database, ODK imports, schedules, and proxy
  configuration are not modified.

## One-time GitHub Environment configuration

In `ayemuthu1963-beep/farm-management-dashboard`:

1. Open **Settings → Environments → New environment**.
2. Create an environment named exactly `Preview`.
3. Restrict deployment branches to `main` and add a required reviewer when the
   repository plan supports it.
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

## First run

After this setup is merged to `main`:

1. Open **Actions → Preview server preflight → Run workflow**.
2. Select `main`.
3. Enter `INSPECT PREVIEW ONLY`.
4. Approve the `preview` environment job if GitHub requests approval.
5. Download the seven-day `preview-server-preflight-*` artifact.

The report must end with `READ_ONLY_PREFLIGHT=PASS`.

## Guarded deployment

Deployment is prepared in two Git branches:

1. `main` contains the reviewed workflow and server-program source.
2. `preview-release` points to the exact, reviewed application revision intended
   for Preview.

Open **Actions → Deploy Preview frontend → Run workflow** on `main`. Enter the
40-character revision currently reported by Preview, the exact 40-character
`preview-release` head, and `DEPLOY PREVIEW ONLY`. Review and approve the
protected `Preview` environment request. A successful report ends with
`PREVIEW_DEPLOYMENT=PASS` and states `production_touched=0`.

## Guarded rollback

Open **Actions → Roll back Preview frontend → Run workflow** on `main`. Enter the
exact 40-character revision currently running on Preview and
`ROLL BACK PREVIEW`. After the separate `Preview` environment approval, the
workflow restores only the immediately previous retained Preview frontend. A
successful report ends with `PREVIEW_ROLLBACK=PASS` and states
`production_touched=0`.

The frontend backend target remains the UAT database `mfms_server_uat` throughout.
The backend, databases, ODK operations, schedules, proxy configuration, and every
Production container are compared before and after each transaction and must be
unchanged.
