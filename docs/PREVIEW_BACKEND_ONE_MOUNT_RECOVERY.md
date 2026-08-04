# Preview backend one-mount recovery

This procedure is a one-time, Preview-only adoption of the already-running
backend revision
`ab6a78ba7869c2d18fd4dba2f7022febd38e7b77`. It removes the unapproved
motor-screenshot bind from the container definition without changing the
backend image, application code, database, ODK, frontend, proxy, or schedules.

It is not a new deployment route. The normal guarded backend deployment and
rollback workflows remain unchanged.

## Reviewed invariants

- Preview user: `muthu`
- Live container: `harvest-api-pilot`
- Exact revision: `ab6a78ba7869c2d18fd4dba2f7022febd38e7b77`
- Exact image ID:
  `sha256:2d7e405460d75863009ba18877c657a6d818c9dfa4ddf97831ce6c6af1de385a`
- Exact image tag:
  `muthu-harvest-dashboard-harvest-api:preview-ab6a78b-20260804T124337Z`
- Network: `harvest-net`
- Address: the existing live Preview backend address
- Port: `127.0.0.1:8015` to `8000/tcp`
- Restart policy: `no`
- Adopted mount set: only `/tmp` to `/host-tmp`, writable
- Candidate port: `127.0.0.1:8016`
- Database: `mfms_server_uat`, read-only verification only
- Motor screenshot upload and Google Vision: disabled
- Motor-screenshot storage directory: present, non-symlink, and contains zero
  regular files

The recovery refuses a third mount, a missing reviewed mount, a changed image
or revision, enabled screenshot features, a non-empty screenshot directory,
or drift in frontend, proxy, schedules, Production, ODK, or unrelated
containers.

## Controlled installation

Install only the exact script from a merged `main` commit. From the trusted
administrator checkout, calculate its SHA-256 without printing any secret:

```powershell
git switch main
git pull --ff-only origin main
$script = '.\scripts\preview-server-backend-recovery.sh'
$expectedHash = (Get-FileHash -Algorithm SHA256 $script).Hash.ToLowerInvariant()
scp $script muthu@168.144.179.221:/home/muthu/.local/libexec/mfms-preview-backend-recovery.new
$remoteHash = ssh muthu@168.144.179.221 'sha256sum /home/muthu/.local/libexec/mfms-preview-backend-recovery.new | cut -d " " -f 1'
if ($remoteHash.Trim() -ne $expectedHash) { throw 'Remote recovery script hash mismatch' }
ssh muthu@168.144.179.221 'chmod 755 /home/muthu/.local/libexec/mfms-preview-backend-recovery.new && mv /home/muthu/.local/libexec/mfms-preview-backend-recovery.new /home/muthu/.local/libexec/mfms-preview-backend-recovery'
```

Stop if the hash comparison or any command fails. Do not install a working-tree
version, a PR-head version, or a script from any branch other than merged
`main`.

## One-time adoption command

Choose a unique identifier in the form
`recovery-YYYYMMDDTHHMMSSZ-short-description`, then run:

```bash
/home/muthu/.local/libexec/mfms-preview-backend-recovery \
  adopt \
  ab6a78ba7869c2d18fd4dba2f7022febd38e7b77 \
  sha256:2d7e405460d75863009ba18877c657a6d818c9dfa4ddf97831ce6c6af1de385a \
  recovery-YYYYMMDDTHHMMSSZ-phase2a \
  'RESTORE PREVIEW BACKEND TO APPROVED ONE MOUNT'
```

The procedure acquires the backend deployment lock, writes a private sanitized
checkpoint, tests a one-mount candidate on port `8016`, switches only the
Preview backend, and writes reconciled guarded state only after all post-switch
checks pass. The prior two-mount container remains stopped under a unique
recovery name.

The reconciled guarded state deliberately records `rollback_container=none`.
The normal guarded rollback workflow must not select the retained two-mount
container. The next successful normal backend deployment will establish a new
one-mount rollback baseline.

## Exact recovery rollback

The successful adoption report prints the exact rollback command, including
the recovery identifier. Its form is:

```bash
/home/muthu/.local/libexec/mfms-preview-backend-recovery \
  rollback \
  ab6a78ba7869c2d18fd4dba2f7022febd38e7b77 \
  recovery-YYYYMMDDTHHMMSSZ-phase2a \
  'ROLL BACK PREVIEW BACKEND RECOVERY'
```

Rollback is an emergency restoration of the retained pre-adoption container.
It performs the same health, version, database, feature, frontend, proxy,
schedule, unrelated-container, and Production checks. A failed adoption or
rollback transaction automatically restores the container that was live when
the transaction began.

Neither operation deletes the motor-screenshot directory or its contents.
