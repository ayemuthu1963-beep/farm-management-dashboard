# Preview asset-register release

## Scope

This release replaces the retired consumables-style Inventory Management interface with an independent register for durable farm assets. Fertiliser Management remains a separate module and uses its existing `fertiliser_*` data model.

## Required Preview order

1. Run the read-only Preview preflight workflow from `main`.
2. Confirm the running backend connection targets `mfms_server_uat` using a read-only `current_database()` check in the approved backend deployment procedure.
3. Apply `db/migrations/005_asset_register_schema.sql` from the authoritative `ayemuthu1963-beep/muthu-harvest-dashboard` Preview branch to `mfms_server_uat`.
4. Deploy the paired backend router and frontend release together through an approved Preview backend process.
5. Smoke-test `/api/asset-register/dashboard`, category creation, and asset registration.
6. Only then run `scripts/clear_legacy_inventory_preview.sql` from that same backend branch on the confirmed `mfms_server_uat` connection.

The existing GitHub `Deploy Preview frontend` workflow is frontend-only: it deliberately asserts that the backend and database are unchanged. It must not be used to apply either SQL migration or to purge legacy inventory entries.
