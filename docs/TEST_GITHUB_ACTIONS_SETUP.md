# MFMS guarded Test release setup

The Test release path is deliberately separate from Preview and Production.
It deploys only the exact head of `test-release`, uses the GitHub `Test`
environment, and accepts only a dedicated forced-command SSH key.

## Fixed safety boundaries

- Target: `https://test.muthufarms.com` and container `mfms-test-web` only.
- Database identity: `mfms_server_test` only.
- Trusted workflow source: `main` only.
- Candidate source: exact 40-character `test-release` head only.
- Shared nginx is never reloaded or edited. The persistent
  `mfms-test-upstream-bridge` resolves `mfms-test-web` through Docker DNS.
- Every operation snapshots all unrelated containers and fails if any changes.
- The Production environment, credentials, containers, and database are absent
  from the workflow.

## GitHub Test environment

Keep required reviewers enabled and restrict deployment branches to `main`.
Install only these Test-scoped values:

- Variable `TEST_SSH_HOST` = `168.144.179.221`
- Variable `TEST_SSH_USER` = `muthu`
- Secret `TEST_SSH_PRIVATE_KEY` = dedicated private key
- Secret `TEST_SSH_KNOWN_HOSTS` = pinned host key line

The matching public key must be installed in `authorized_keys` with:

```text
command="/home/muthu/.local/libexec/mfms-test-deploy",no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding
```

## Deploy

Dispatch `Deploy Test frontend` from `main` with:

- exact current Test revision;
- exact candidate revision, which must equal `test-release` head; and
- confirmation `DEPLOY TEST ONLY`.

The workflow runs preflight, builds the candidate from GitHub, checks Test
environment/database identity on an isolated port, switches only
`mfms-test-web`, verifies the Test-only bridge and public authentication guard,
and stores a sanitized report.

## Rollback

Dispatch `Roll back Test frontend` from `main` with the exact currently deployed
revision and confirmation `ROLL BACK TEST`. The server restores the immediately
previous verified image digest and retains the displaced image as the next
rollback target.

## Rehearsal evidence

Before relying on the workflow, record all three results:

1. `preflight-test` and a successful exact-SHA deployment;
2. `rehearse-test-health-failure`, which starts a deliberately mislabelled
   candidate on the isolated candidate port and proves it cannot pass identity;
3. `rollback-test`, followed by Test bridge and authenticated browser checks.

No Production credential is to be added while rehearsing Test.
