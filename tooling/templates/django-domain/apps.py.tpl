from django.apps import AppConfig


class {{ClassName}}Config(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.{{name}}"
    label = "stream_{{name}}"
