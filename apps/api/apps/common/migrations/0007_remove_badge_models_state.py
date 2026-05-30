# State-only: badge ORM now lives under stream_accounts (tables unchanged)

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0006_transfer_domain_models_state"),
        ("stream_accounts", "0002_badges_state"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="UserBadgeAssignment"),
                migrations.DeleteModel(name="UserBadgeDefinition"),
            ],
        ),
    ]
