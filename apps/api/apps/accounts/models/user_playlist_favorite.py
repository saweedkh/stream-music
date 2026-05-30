"""User favorite playlists."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class UserPlaylistFavorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playlist_favorites")
    playlist = models.ForeignKey("playlists.Playlist", on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "common_userplaylistfavorite"
        unique_together = ("user", "playlist")
        indexes = [models.Index(fields=["user", "-created_at"], name="common_user_user_id_7b2c1e_idx")]
