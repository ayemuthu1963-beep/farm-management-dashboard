import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts" / "production-backup-role-remediate.py"


def load_helper():
    spec = importlib.util.spec_from_file_location("production_backup_role_remediate", HELPER)
    if spec is None or spec.loader is None:
        raise AssertionError("unable to load remediation helper")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ProductionBackupRoleRemediationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_helper()

    def inventory(self, **changes):
        values = {
            "database": self.module.EXPECTED_DATABASE,
            "current_user": self.module.EXPECTED_OWNER,
            "current_user_superuser": False,
            "current_user_createrole": False,
            "backup_role": (
                self.module.EXPECTED_BACKUP_ROLE,
                True,
                False,
                False,
                False,
                False,
                False,
            ),
            "schemas": frozenset({("public", "pg_database_owner", True)}),
            "missing_relations": self.module.EXPECTED_RELATIONS,
            "missing_sequences": self.module.EXPECTED_SEQUENCES,
            "default_privileges": frozenset(),
            "large_objects": 0,
            "rls_tables": 0,
        }
        values.update(changes)
        return self.module.Inventory(**values)

    def test_exact_observed_drift_is_accepted_before_remediation(self):
        result = self.module.validate_inventory(self.inventory(), allow_expected_drift=True)
        self.assertEqual(result, "expected-drift")

    def test_fully_remediated_state_is_idempotent(self):
        result = self.module.validate_inventory(
            self.inventory(
                missing_relations=frozenset(),
                missing_sequences=frozenset(),
                default_privileges=self.module.EXPECTED_DEFAULT_PRIVILEGES,
            ),
            allow_expected_drift=True,
        )
        self.assertEqual(result, "already-remediated")

    def test_unexpected_missing_relation_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "approved set"):
            self.module.validate_inventory(
                self.inventory(
                    missing_relations=self.module.EXPECTED_RELATIONS
                    | {("public", "unexpected", "r", self.module.EXPECTED_OWNER)}
                ),
                allow_expected_drift=True,
            )

    def test_post_remediation_missing_privilege_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "still has missing"):
            self.module.validate_inventory(self.inventory(), allow_expected_drift=False)

    def test_wrong_database_and_elevated_roles_fail_closed(self):
        for changes in (
            {"database": "mfms_server_uat"},
            {"current_user_superuser": True},
            {"current_user_createrole": True},
            {"rls_tables": 1},
        ):
            with self.subTest(changes=changes), self.assertRaises(RuntimeError):
                self.module.validate_inventory(
                    self.inventory(**changes), allow_expected_drift=True
                )


if __name__ == "__main__":
    unittest.main()
