"""Ensure apps.common is migration-only (no runtime models)."""

from django.apps import apps
from django.test import SimpleTestCase


class CommonMigrationShimTests(SimpleTestCase):
    def test_common_app_has_no_models(self):
        config = apps.get_app_config("common")
        self.assertEqual(list(config.get_models()), [])

    def test_common_stays_in_installed_apps_for_migrations(self):
        from django.conf import settings

        self.assertTrue(any("common" in name for name in settings.INSTALLED_APPS))
