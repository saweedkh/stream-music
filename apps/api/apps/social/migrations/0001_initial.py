# State-only: tables remain common_* in the database

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("common", "0005_user_follow"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("stream_channels", "0013_add_performance_indexes"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="UserPublicProfile",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("bio", models.CharField(blank=True, default="", max_length=500)),
                        ("is_public", models.BooleanField(default=False)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        (
                            "user",
                            models.OneToOneField(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="public_profile",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={"db_table": "common_userpublicprofile"},
                ),
                migrations.CreateModel(
                    name="UserFollow",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "follower",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="following_users",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                        (
                            "following",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="follower_users",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_userfollow",
                        "indexes": [models.Index(fields=["following", "follower"], name="common_user_follow_idx")],
                        "unique_together": {("follower", "following")},
                    },
                ),
                migrations.CreateModel(
                    name="ChannelFollow",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("notify_live", models.BooleanField(default=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "channel",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="followers",
                                to="stream_channels.channel",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="channel_follows",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_channelfollow",
                        "unique_together": {("user", "channel")},
                    },
                ),
            ],
        ),
    ]
