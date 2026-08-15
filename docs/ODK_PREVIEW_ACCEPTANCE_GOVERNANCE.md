# ODK Preview Acceptance Governance

This document is the deployment-acceptance authority for the MFMS Beetle Trap
and Well Water ODK workflows.

## Project boundary

| ODK project | Role | Acceptance-test use |
| --- | --- | --- |
| Project 22 — `Muthu Field Collector : Project no 22` | Production operational forms | Prohibited |
| Project 23 — `MFMS Preview Field Collector : Project no 23` | Preview/UAT acceptance forms | Required |

Never repoint Project 22 for Preview testing. Do not submit Preview acceptance
records through Project 22, change its routing for a test, modify its forms
solely for testing, or delete Production submissions.

## Current Project 23 forms

| Workflow | Form ID | Display name | XML form ID | Version | State |
| --- | ---: | --- | --- | --- | --- |
| Beetle Trap Counts | 67 | `🪲 MFMS Preview — Beetle Trap Counts TEST` | `mfms_preview_beetle_test_v1` | `20260723.1` | open |
| Well Water | 66 | `💧 MFMS Preview — Well Water TEST` | `mfms_preview_well_water_test_v1` | `20260723.2` | open |

Reconfirm these identities from ODK Central metadata immediately before each
acceptance run; numeric form IDs and versions must not be inferred from
Project 22.

## Mandatory routing gate

Before any submission, prove both Project 23 form paths resolve as follows:

```text
ODK Project 23
  -> the Project 23 Preview sync wrapper
  -> harvest-api-pilot / Preview API
  -> MFMS_ENV=preview
  -> MFMS_TARGET_DATABASE=mfms_server_uat
  -> mfms_server_uat
```

The Preview runtime credential must connect to UAT and be denied by Production
and Test. Stop without submitting if either Project 23 workflow references the
Production API, `mfms_server_prod`, or a Project 22 route.

## Acceptance procedure

1. Record Project 22 and Project 23 submission counts and latest submission
   timestamps.
2. Record narrow Production and UAT Beetle/Well Water baselines.
3. Use a unique marker in the form's instance name, for example
   `PREVIEW_ACCEPTANCE_YYYYMMDD_HHMMSS`.
4. Submit exactly one Project 23 Beetle record and one Project 23 Well Water
   record.
5. Run only the established Project 23 Preview sync wrapper for the relevant
   form.
6. Verify ODK receipt, UAT import, Preview API/page behavior, absence of the
   marker from Production, and zero Project 22 submissions created by the
   acceptance run.
7. Re-run the complete Production/Preview/Test database-isolation matrix and
   the MFMS health/IPAM gates.

Do not use direct SQL deletion for test cleanup. If no separately documented,
approved cleanup workflow exists, retain the uniquely marked rows as
`RETAINED PREVIEW ACCEPTANCE TEST DATA`.

## Production invariants

An acceptance run passes only when:

- no Project 22 acceptance submission was created;
- no Project 23 acceptance marker exists in `mfms_server_prod`;
- Production container IDs, images, database target, and fixed IP are
  unchanged;
- `harvest-api` remains the sole owner of `172.19.0.2`;
- `harvest-net` retains dynamic pool `172.19.128.0/17`;
- Production, Preview, Authentication, ODK, APIs, PostgreSQL, Portainer, TLS,
  DNS, and unknown-host HTTP 421 checks pass.
