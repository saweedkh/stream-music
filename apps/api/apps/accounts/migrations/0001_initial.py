# State-only: tables remain common_* in the database

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("common", "0005_user_follow"),
        ("tracks", "0003_track_file_hash"),
        ("playlists", "0003_channelqueueupvote"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="UserTrackFavorite",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "track",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="favorited_by",
                                to="tracks.track",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="track_favorites",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_usertrackfavorite",
                        "indexes": [models.Index(fields=["user", "-created_at"], name="common_user_user_id_6a8f0d_idx")],
                        "unique_together": {("user", "track")},
                    },
                ),
                migrations.CreateModel(
                    name="UserPlaylistFavorite",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "playlist",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="favorited_by",
                                to="playlists.playlist",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="playlist_favorites",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "common_userplaylistfavorite",
                        "indexes": [models.Index(fields=["user", "-created_at"], name="common_user_user_id_7b2c1e_idx")],
                        "unique_together": {("user", "playlist")},
                    },
                ),
            ],
        ),
    ]
