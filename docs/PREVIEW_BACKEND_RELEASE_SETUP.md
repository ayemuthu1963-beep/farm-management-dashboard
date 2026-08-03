# Preview Backend Release Setup

This is the reusable deployment path for the MFMS Preview API and its
forward-only UAT database migrations. It is deliberately separate from the
existing frontend-only release path.

It can operate only on:

- server account: `muthu`;
- API container: `harvest-api-pilot`;
- Docker network: `harvest-net`;
- database: `mfms_server_uat`;
- public target: `https://preview.muthufarms.com`.

It cannot select a Production container, Production database, arbitrary SSH
command, proxy configuration, ODK configuration, or scheduler command.

## Normal future release procedure

1. Codex implements and tests a backend change in
   `ayemuthu1963-beep/muthu-harvest-dashboard`.
2. The reviewed backend commit is merged into `preview-release`.
3. Codex updates that commit's `deploy/preview-backend-release.json` with the
   exact migration checksums and required API paths.
4. The owner runs **Deploy Preview backend** from the trusted `main` branch of
   `farm-management-dashboard`, supplies the exact backend SHA, and enters
   `DEPLOY PREVIEW BACKEND ONLY`.
5. The workflow starts a temporary API on `127.0.0.1:8016`, proves it uses
   `mfms_server_uat`, applies only declared migrations, checks health/OpenAPI,
   then replaces only `harvest-api-pilot`.
6. The owner tests Preview. Production remains a separate approval and release.

Codex can prepare the workflow request and verify the report. The owner does
not need to log in to the server for a normal future release.

## Migration policy

Database migration files must be:

- explicitly listed with their SHA-256 checksum;
- idempotent or protected by the migration ledger;
- additive and forward-compatible with the prior Preview API;
- limited to `mfms_server_uat`.

The release program records migrations in `mfms_preview_schema_migrations` and
never runs an automatic `DOWN` migration. A failed API switch restores the
previous API container, but does not rewrite database data. Destructive data or
schema changes require a separately reviewed recovery plan and explicit owner
approval.

## One-time installation

Perform this only after the reviewed control-repository PR has been merged to
`main`. Keep the existing frontend deploy and preflight keys unchanged.

### 1. Generate the new dedicated key on the administrator PC

In Windows PowerShell, from a trusted local folder:

```powershell
$keyDir = Join-Path $env:USERPROFILE '.ssh\mfms-preview-backend'
New-Item -ItemType Directory -Force -Path $keyDir | Out-Null
$keyPath = Join-Path $keyDir 'id_ed25519'
ssh-keygen -t ed25519 -a 64 -f $keyPath -C 'mfms-preview-backend-github'
```

For this one automation key, leave the passphrase empty when `ssh-keygen`
prompts. Its safety comes from the GitHub protected environment and the server
forced-command restriction below. Do not paste the private key into chat, a
repository, an issue, a PR, or an Actions log.

### 2. Copy the reviewed server programs to the MFMS server

First log in normally as `muthu` and create the two private directories:

```bash
mkdir -p /home/muthu/.local/libexec /home/muthu/.local/state/mfms-preview-github
chmod 700 /home/muthu/.local/libexec /home/muthu/.local/state/mfms-preview-github
exit
```

Then, from a local checkout of the exact merged `main` commit of
`farm-management-dashboard`, run:

```powershell
scp .\scripts\preview-server-backend-deploy.sh muthu@168.144.179.221:/home/muthu/.local/libexec/mfms-preview-backend-deploy
scp .\scripts\bootstrap-preview-backend-state.sh muthu@168.144.179.221:/home/muthu/.local/libexec/bootstrap-preview-backend-state
```

Log in normally as `muthu` again and set the executable permissions:

```bash
chmod 755 /home/muthu/.local/libexec/mfms-preview-backend-deploy
chmod 755 /home/muthu/.local/libexec/bootstrap-preview-backend-state
```

### 3. Create the dedicated read-only backend checkout

The server must keep a clean checkout only for this deployment program. Its
GitHub identity is separate from the forced-command SSH key used by Actions.
It has read access to `muthu-harvest-dashboard` only.

On the server as `muthu`, create the repository deploy key. Leave its
passphrase empty so the restricted release program can fetch non-interactively:

```bash
repo_key=/home/muthu/.ssh/mfms-preview-backend-repository
test ! -e "$repo_key" || { echo "Repository deploy key already exists; stop."; exit 1; }
ssh-keygen -t ed25519 -a 64 -f "$repo_key" -C 'mfms-preview-backend-repository-readonly'
cat "${repo_key}.pub"
```

Copy the displayed **public** key into GitHub:

1. Open `ayemuthu1963-beep/muthu-harvest-dashboard` → **Settings** →
   **Deploy keys** → **Add deploy key**.
2. Title it `mfms-preview-backend-repository-readonly`.
3. Paste the public key.
4. Leave **Allow write access** unchecked, then save.

Back on the server, add the dedicated GitHub host alias without changing any
existing SSH host configuration:

```bash
grep -Fq 'Host github.com-mfms-preview-backend' /home/muthu/.ssh/config 2>/dev/null \
  && { echo "GitHub host alias already exists; stop."; exit 1; }
cat >> /home/muthu/.ssh/config <<'EOF'
Host github.com-mfms-preview-backend
  HostName github.com
  User git
  IdentityFile /home/muthu/.ssh/mfms-preview-backend-repository
  IdentitiesOnly yes
  HostKeyAlias github.com
  StrictHostKeyChecking yes
EOF
chmod 600 /home/muthu/.ssh/config
```

The GitHub host key must already be known to the `muthu` account. Verify the
read-only key, then create the one authoritative checkout:

```bash
ssh -T git@github.com-mfms-preview-backend
git clone --branch preview-release --single-branch \
  git@github.com-mfms-preview-backend:ayemuthu1963-beep/muthu-harvest-dashboard.git \
  /home/muthu/muthu-harvest-dashboard-preview-release
git -C /home/muthu/muthu-harvest-dashboard-preview-release branch --show-current
test -z "$(git -C /home/muthu/muthu-harvest-dashboard-preview-release status --short)"
```

The SSH test is expected to say that GitHub does not provide shell access; the
clone must finish successfully, the branch must be `preview-release`, and the
final status check must be silent. If the GitHub host key or read-only key test
fails, stop rather than weakening host-key checking or using a personal token.

### 4. Add only the new forced-command public key

On the administrator PC, create the single authorized-key line:

```powershell
$publicKey = Get-Content "${keyPath}.pub" -Raw
$forcedKey = 'command="/home/muthu/.local/libexec/mfms-preview-backend-deploy",no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding ' + $publicKey.Trim()
Set-Content -Path (Join-Path $keyDir 'authorized_key_line.txt') -Value $forcedKey -Encoding ascii
```

Copy it to the server:

```powershell
scp (Join-Path $keyDir 'authorized_key_line.txt') muthu@168.144.179.221:/home/muthu/.ssh/mfms-preview-backend.authorized_key
```

On the server as `muthu`, inspect the new one-line file, then append it without
altering any existing keys:

```bash
wc -l /home/muthu/.ssh/mfms-preview-backend.authorized_key
grep -Fq 'mfms-preview-backend-github' /home/muthu/.ssh/mfms-preview-backend.authorized_key
cat /home/muthu/.ssh/mfms-preview-backend.authorized_key >> /home/muthu/.ssh/authorized_keys
chmod 700 /home/muthu/.ssh
chmod 600 /home/muthu/.ssh/authorized_keys
rm /home/muthu/.ssh/mfms-preview-backend.authorized_key
```

The `grep` command must find the key comment. If `wc -l` reports anything other
than `1`, stop instead of appending it.

### 5. Bootstrap the existing Preview API as the rollback baseline

Still on the server, determine the exact current commit without changing the
container. New images have a full revision label. The legacy image tag has a
short Git revision; the clean checkout resolves it to the full SHA.

```bash
repo=/home/muthu/muthu-harvest-dashboard-preview-release
image_id=$(docker inspect --format '{{.Image}}' harvest-api-pilot)
image_tag=$(docker inspect --format '{{.Config.Image}}' harvest-api-pilot)
image_revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_id")

if [[ "$image_revision" =~ ^[0-9a-f]{40}$ ]]; then
  current_revision=$image_revision
else
  short_revision=${image_tag#*:github-}
  short_revision=${short_revision%%-*}
  [[ "$short_revision" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Cannot resolve legacy image tag; stop."; exit 1; }
  current_revision=$(git -C "$repo" rev-parse "${short_revision}^{commit}")
fi

printf 'current_revision=%s\n' "$current_revision"
/home/muthu/.local/libexec/bootstrap-preview-backend-state "$current_revision"
```

The program must finish with `PREVIEW_BACKEND_BOOTSTRAP=PASS`. It writes only
the protected Preview rollback state; it does not restart containers or modify
the database.

### 6. Save the private key only in GitHub's protected Preview environment

In `ayemuthu1963-beep/farm-management-dashboard`:

1. Open **Settings → Environments → Preview**.
2. Confirm allowed deployment branches are **only `main`**.
3. Add an environment secret named
   `PREVIEW_BACKEND_DEPLOY_SSH_PRIVATE_KEY`.
4. Copy the complete content of `$keyPath` into that secret.
5. Reuse the existing `PREVIEW_SSH_HOST`, `PREVIEW_SSH_USER`, and
   `PREVIEW_SSH_KNOWN_HOSTS`; do not change them.

Never save this private key in GitHub variables, repository secrets, source
files, workflows, comments, or chat.

### 7. Prove that the new key cannot open a shell

From the administrator PC, this read-only restriction check must be rejected:

```powershell
ssh -i $keyPath -o IdentitiesOnly=yes -T muthu@168.144.179.221 'hostname'
```

Expected result: `PREVIEW_BACKEND_DEPLOY_BLOCKED=...`. A shell prompt, host
name, or arbitrary command output is a stop condition.

Do not test a real deployment until a reviewed backend release descriptor and
candidate revision are ready.

## Deploying and rolling back

After a successful deploy, GitHub stores a sanitized report for 30 days. It
must include all of the following:

```text
deployment_environment=Preview
deployment_component=backend
database=mfms_server_uat
frontend_unchanged=true
production_touched=0
PREVIEW_BACKEND_DEPLOYMENT=PASS
```

The **Roll back Preview backend** workflow restores only the retained prior
Preview API container. It leaves forward-only migrations in place, so use it
only when the prior API is compatible with the already-applied additive schema.

## Immediate Sapling release

After the backend deployment path is installed and tested, the Sapling release
will deploy the reviewed backend candidate, apply
`20260803_tree_lifecycle_saplings.sql`, and then permit the Admin Console to
validate and import the 3 August 2026 survey into Preview/UAT. Production is
not part of this process.
