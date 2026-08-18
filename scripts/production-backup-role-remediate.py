#!/usr/bin/env python3
"""One-time, fail-closed Production backup-role privilege remediation.

Run this exact reviewed file inside the currently live Production backend
container. It changes only object/default ACLs owned by ``mfms_prod_app`` and
does not execute application DML.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


EXPECTED_DATABASE = "mfms_server_prod"
EXPECTED_ENVIRONMENT = "Production"
EXPECTED_LIVE_REVISION = "94b28f17702e409e13d25e288fc5cd4b9bbef545"
EXPECTED_OWNER = "mfms_prod_app"
EXPECTED_BACKUP_ROLE = "mfms_backup"
EXPECTED_RELATIONS = frozenset(
    {
        ("public", "mfms_irrigation_plan_audit", "r", EXPECTED_OWNER),
        ("public", "mfms_irrigation_plan_settings", "r", EXPECTED_OWNER),
    }
)
EXPECTED_SEQUENCES = frozenset(
    {("public", "mfms_irrigation_plan_audit_audit_id_seq", EXPECTED_OWNER)}
)
EXPECTED_DEFAULT_PRIVILEGES = frozenset(
    {
        (EXPECTED_OWNER, "public", "S", EXPECTED_BACKUP_ROLE, "SELECT"),
        (EXPECTED_OWNER, "public", "r", EXPECTED_BACKUP_ROLE, "SELECT"),
    }
)


@dataclass(frozen=True)
class Inventory:
    database: str
    current_user: str
    current_user_superuser: bool
    current_user_createrole: bool
    backup_role: tuple[Any, ...]
    schemas: frozenset[tuple[Any, ...]]
    missing_relations: frozenset[tuple[Any, ...]]
    missing_sequences: frozenset[tuple[Any, ...]]
    default_privileges: frozenset[tuple[Any, ...]]
    large_objects: int
    rls_tables: int


def _fetch_inventory(cursor: Any) -> Inventory:
    cursor.execute(
        """
        SELECT current_database(), current_user,
               (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),
               (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user)
        """
    )
    database, current_user, superuser, createrole = cursor.fetchone()

    cursor.execute(
        """
        SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
               rolreplication, rolbypassrls
        FROM pg_roles WHERE rolname = %s
        """,
        (EXPECTED_BACKUP_ROLE,),
    )
    backup_role = cursor.fetchone()

    cursor.execute(
        """
        SELECT n.nspname, pg_get_userbyid(n.nspowner),
               has_schema_privilege(%s, n.oid, 'USAGE')
        FROM pg_namespace n
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
        ORDER BY n.nspname
        """,
        (EXPECTED_BACKUP_ROLE,),
    )
    schemas = frozenset(tuple(row) for row in cursor.fetchall())

    cursor.execute(
        """
        WITH relations AS MATERIALIZED (
            SELECT n.nspname, c.relname, c.relkind, c.relowner, c.oid
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
              AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        )
        SELECT nspname, relname, relkind, pg_get_userbyid(relowner)
        FROM relations
        WHERE NOT has_table_privilege(%s, oid, 'SELECT')
        ORDER BY nspname, relname
        """,
        (EXPECTED_BACKUP_ROLE,),
    )
    missing_relations = frozenset(tuple(row) for row in cursor.fetchall())

    cursor.execute(
        """
        WITH sequences AS MATERIALIZED (
            SELECT n.nspname, c.relname, c.relowner, c.oid
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
              AND c.relkind = 'S'
        )
        SELECT nspname, relname, pg_get_userbyid(relowner)
        FROM sequences
        WHERE NOT has_sequence_privilege(%s, oid, 'SELECT')
        ORDER BY nspname, relname
        """,
        (EXPECTED_BACKUP_ROLE,),
    )
    missing_sequences = frozenset(tuple(row) for row in cursor.fetchall())

    cursor.execute(
        """
        SELECT pg_get_userbyid(d.defaclrole), coalesce(n.nspname, ''),
               d.defaclobjtype, pg_get_userbyid(x.grantee), x.privilege_type
        FROM pg_default_acl d
        LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
        CROSS JOIN LATERAL aclexplode(d.defaclacl) x
        WHERE pg_get_userbyid(d.defaclrole) = %s
          AND pg_get_userbyid(x.grantee) = %s
        ORDER BY 1, 2, 3, 5
        """,
        (EXPECTED_OWNER, EXPECTED_BACKUP_ROLE),
    )
    default_privileges = frozenset(tuple(row) for row in cursor.fetchall())

    cursor.execute("SELECT count(*) FROM pg_largeobject_metadata")
    large_objects = int(cursor.fetchone()[0])
    cursor.execute(
        """
        SELECT count(*)
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          AND c.relkind IN ('r', 'p') AND c.relrowsecurity
        """
    )
    rls_tables = int(cursor.fetchone()[0])

    return Inventory(
        database=str(database),
        current_user=str(current_user),
        current_user_superuser=bool(superuser),
        current_user_createrole=bool(createrole),
        backup_role=tuple(backup_role) if backup_role is not None else (),
        schemas=schemas,
        missing_relations=missing_relations,
        missing_sequences=missing_sequences,
        default_privileges=default_privileges,
        large_objects=large_objects,
        rls_tables=rls_tables,
    )


def validate_inventory(inventory: Inventory, *, allow_expected_drift: bool) -> str:
    if inventory.database != EXPECTED_DATABASE:
        raise RuntimeError("Production backup remediation reached the wrong database")
    if inventory.current_user != EXPECTED_OWNER:
        raise RuntimeError("Production backup remediation reached the wrong application role")
    if inventory.current_user_superuser or inventory.current_user_createrole:
        raise RuntimeError("Production application role has an unapproved elevated attribute")
    if inventory.backup_role != (
        EXPECTED_BACKUP_ROLE,
        True,
        False,
        False,
        False,
        False,
        False,
    ):
        raise RuntimeError("Production backup role attributes do not match the approved contract")
    if inventory.schemas != frozenset({("public", "pg_database_owner", True)}):
        raise RuntimeError("Production schema/backup-USAGE inventory changed unexpectedly")
    if inventory.large_objects != 0 or inventory.rls_tables != 0:
        raise RuntimeError("Production backup remediation cannot cover large objects or RLS tables")

    if (
        not inventory.missing_relations
        and not inventory.missing_sequences
        and EXPECTED_DEFAULT_PRIVILEGES.issubset(inventory.default_privileges)
    ):
        return "already-remediated"

    if not allow_expected_drift:
        raise RuntimeError("Production backup role still has missing privileges after remediation")
    if inventory.missing_relations != EXPECTED_RELATIONS:
        raise RuntimeError("Production missing relation privileges differ from the approved set")
    if inventory.missing_sequences != EXPECTED_SEQUENCES:
        raise RuntimeError("Production missing sequence privileges differ from the approved set")
    if inventory.default_privileges:
        raise RuntimeError("Production application-owner default privileges are partially configured")
    return "expected-drift"


def main() -> None:
    if os.environ.get("MFMS_BUILD_ENVIRONMENT") != EXPECTED_ENVIRONMENT:
        raise SystemExit("Production backup remediation is not running in Production")
    if os.environ.get("MFMS_GIT_COMMIT") != EXPECTED_LIVE_REVISION:
        raise SystemExit("Production backend revision changed before backup remediation")

    import psycopg

    from app.config import get_settings

    with psycopg.connect(get_settings().database_url) as connection:
        with connection.cursor() as cursor:
            before = _fetch_inventory(cursor)
            state = validate_inventory(before, allow_expected_drift=True)
            if state == "expected-drift":
                cursor.execute(
                    "GRANT SELECT ON TABLE "
                    "public.mfms_irrigation_plan_audit, "
                    "public.mfms_irrigation_plan_settings TO mfms_backup"
                )
                cursor.execute(
                    "GRANT SELECT ON SEQUENCE "
                    "public.mfms_irrigation_plan_audit_audit_id_seq TO mfms_backup"
                )
                cursor.execute(
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                    "GRANT SELECT ON TABLES TO mfms_backup"
                )
                cursor.execute(
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                    "GRANT SELECT ON SEQUENCES TO mfms_backup"
                )
            after = _fetch_inventory(cursor)
            validate_inventory(after, allow_expected_drift=False)
        connection.commit()

    print(f"database={EXPECTED_DATABASE}")
    print(f"backup_role={EXPECTED_BACKUP_ROLE}")
    print(f"object_owner={EXPECTED_OWNER}")
    print(f"pre_remediation_state={state}")
    print("missing_table_select=0")
    print("missing_sequence_select=0")
    print("default_table_select=true")
    print("default_sequence_select=true")
    print("application_rows_changed=0")
    print("PRODUCTION_BACKUP_ROLE_REMEDIATION=PASS")


if __name__ == "__main__":
    main()
