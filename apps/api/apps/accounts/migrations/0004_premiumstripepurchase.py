from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("stream_accounts", "0003_premiuminvitecode_premiumcoderedemption"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PremiumStripePurchase",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("stripe_session_id", models.CharField(db_index=True, max_length=255, unique=True)),
                ("amount_total", models.PositiveIntegerField(blank=True, null=True)),
                ("currency", models.CharField(blank=True, default="", max_length=8)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="stripe_premium_purchases",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
                "indexes": [models.Index(fields=["user", "-created_at"], name="stream_acco_user_id_idx")],
            },
        ),
    ]
