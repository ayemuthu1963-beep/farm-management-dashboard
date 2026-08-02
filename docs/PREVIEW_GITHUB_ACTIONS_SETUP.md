# Preview GitHub Actions Deployment Setup

This setup creates a manual, Preview-only path from GitHub Actions to the MFMS
Preview server. It does not create an automatic deployment and it never targets
Production.

## Safety boundary

- The workflow runs only through `workflow_dispatch`.
- The exact confirmation text is `INSPECT PREVIEW ONLY`.
- The job uses the protected GitHub Environment named `preview`.
- GitHub permissions are read-only, and external Actions are pinned to full
  immutable commit hashes.
- SSH host verification is pinned; `ssh-keyscan` is not used by the workflow.
- Root SSH is prohibited. The approved remote account is `muthu`.
- The initial workflow only inspects the current Preview containers and returns a
  sanitized report. It cannot stop, remove, rename, create, or restart containers.
- Environment values are never printed; only environment variable names are
  included in the report.
- Production, the backend, database, ODK imports, schedules, and proxy
  configuration are not modified.

## One-time GitHub Environment configuration

In `ayemuthu1963-beep/farm-management-dashboard`:

1. Open **Settings → Environments → New environment**.
2. Create an environment named exactly `preview`.
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

Never place any of these values in source control, workflow inputs, issue or pull
request comments, Actions logs, or ChatGPT messages.

## First run

After this setup is merged to `main`:

1. Open **Actions → Preview server preflight → Run workflow**.
2. Select `main`.
3. Enter `INSPECT PREVIEW ONLY`.
4. Approve the `preview` environment job if GitHub requests approval.
5. Download the seven-day `preview-server-preflight-*` artifact.

The report must end with `READ_ONLY_PREFLIGHT=PASS`. Codex then uses the
sanitized container contract to add the second-stage deployment and rollback
workflow without guessing any live runtime setting.
