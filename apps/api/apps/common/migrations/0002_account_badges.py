# Account badge definitions and assignments

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_system_badges(apps, schema_editor):
    UserBadgeDefinition = apps.get_model("common", "UserBadgeDefinition")
    defaults = [
        {
            "slug": "platform_superuser",
            "label": "Platform admin",
            "description": "Full platform superuser",
            "icon": "crown",
            "color": "amber",
            "priority": 10,
            "is_system": True,
            "is_active": True,
        },
        {
            "slug": "platform_staff",
            "label": "Staff",
            "description": "Verified staff member",
            "icon": "badge-check",
            "color": "sky",
            "priority": 20,
            "is_system": True,
            "is_active": True,
        },
        {
            "slug": "premium",
            "label": "Premium",
            "description": "Premium subscriber (assign manually or via billing later)",
            "icon": "sparkles",
            "color": "violet",
            "priority": 30,
            "is_system": True,
            "is_active": True,
        },
    ]
    for row in defaults:
        UserBadgeDefinition.objects.update_or_create(slug=row["slug"], defaults=row)


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0001_user_favorites"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserBadgeDefinition",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=40, unique=True)),
                ("label", models.CharField(max_length=80)),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                ("icon", models.CharField(choices=[("badge-check", "Verified tick"), ("crown", "Crown"), ("sparkles", "Sparkles"), ("star", "Star"), ("shield", "Shield"), ("music", "Music"), ("heart", "Heart"), ("zap", "Zap"), ("gem", "Gem")], default="badge-check", max_length=32)),
                ("color", models.CharField(choices=[("sky", "Sky blue"), ("amber", "Gold"), ("violet", "Violet"), ("emerald", "Emerald"), ("rose", "Rose"), ("brand", "Brand green"), ("slate", "Slate")], default="sky", max_length=24)),
                ("priority", models.PositiveSmallIntegerField(default=100, help_text="Lower numbers appear first.")),
                ("is_system", models.BooleanField(default=False, help_text="Reserved slug; cannot be deleted. May be auto-applied from platform rules.")),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["priority", "slug"]},
        ),
        migrations.CreateModel(
            name="UserBadgeAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                (
                    "assigned_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="badges_assigned", to=settings.AUTH_USER_MODEL),
                ),
                ("badge", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="common.userbadgedefinition")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="badge_assignments", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "indexes": [models.Index(fields=["user", "badge"], name="common_user_user_id_badge_idx")],
                "unique_together": {("user", "badge")},
            },
        ),
        migrations.RunPython(seed_system_badges, migrations.RunPython.noop),
    ]
