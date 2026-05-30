from django.apps import AppConfig


class CommonConfig(AppConfig):
    """Migration-history shim only — domain code lives in core, accounts, support, …"""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.common"
    label = "common"
    verbose_name = "Common (migrations)"
