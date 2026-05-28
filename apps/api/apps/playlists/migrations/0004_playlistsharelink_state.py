# State-only: PlaylistShareLink table already exists as common_playlistsharelink

import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0005_user_follow"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("playlists", "0003_channelqueueupvote"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="PlaylistShareLink",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                        (
                            "privacy",
                            models.CharField(
                                choices=[("public", "Public"), ("unlisted", "Unlisted")],
                                default="unlisted",
                                max_length=16,
                            ),
                        ),
                        ("is_active", models.BooleanField(default=True)),
                        ("expires_at", models.DateTimeField(blank=True, null=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "created_by",
                            models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
                        ),
                        (
                            "playlist",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="share_links",
                                to="playlists.playlist",
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_playlistsharelink",
                        "indexes": [models.Index(fields=["token", "is_active"], name="common_play_token_91ab0d_idx")],
                    },
                ),
            ],
        ),
    ]
