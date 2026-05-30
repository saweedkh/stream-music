# State-only: badge tables stay common_* in the database (see accounts.models.*.Meta.db_table)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("stream_accounts", "0001_initial"),
        ("common", "0006_transfer_domain_models_state"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="UserBadgeDefinition",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(
                                auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                            ),
                        ),
                        ("slug", models.SlugField(max_length=40, unique=True)),
                        ("label", models.CharField(max_length=80)),
                        ("description", models.CharField(blank=True, default="", max_length=255)),
                        (
                            "icon",
                            models.CharField(
                                choices=[
                                    ("badge-check", "Verified tick"),
                                    ("crown", "Crown"),
                                    ("sparkles", "Sparkles"),
                                    ("star", "Star"),
                                    ("shield", "Shield"),
                                    ("music", "Music"),
                                    ("heart", "Heart"),
                                    ("zap", "Zap"),
                                    ("gem", "Gem"),
                                ],
                                default="badge-check",
                                max_length=32,
                            ),
                        ),
                        (
                            "color",
                            models.CharField(
                                choices=[
                                    ("sky", "Sky blue"),
                                    ("amber", "Gold"),
                                    ("violet", "Violet"),
                                    ("emerald", "Emerald"),
                                    ("rose", "Rose"),
                                    ("brand", "Brand green"),
                                    ("slate", "Slate"),
                                ],
                                default="sky",
                                max_length=24,
                            ),
                        ),
                        (
                            "priority",
                            models.PositiveSmallIntegerField(default=100, help_text="Lower numbers appear first."),
                        ),
                        (
                            "is_system",
                            models.BooleanField(
                                default=False,
                                help_text="Reserved slug; cannot be deleted. May be auto-applied from platform rules.",
                            ),
                        ),
                        ("is_active", models.BooleanField(default=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                    ],
                    options={
                        "db_table": "common_userbadgedefinition",
                        "ordering": ["priority", "slug"],
                    },
                ),
                migrations.CreateModel(
                    name="UserBadgeAssignment",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(
                                auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                            ),
                        ),
                        ("assigned_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "assigned_by",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name="badges_assigned",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                        (
                            "badge",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="assignments",
                                to="stream_accounts.userbadgedefinition",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="badge_assignments",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_userbadgeassignment",
                        "indexes": [models.Index(fields=["user", "badge"], name="common_user_user_id_badge_idx")],
                        "unique_together": {("user", "badge")},
                    },
                ),
            ],
        ),
    ]
