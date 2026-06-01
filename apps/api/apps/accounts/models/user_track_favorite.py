"""User favorite tracks."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class UserTrackFavorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="track_favorites")
    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "common_usertrackfavorite"
        unique_together = ("user", "track")
        indexes = [models.Index(fields=["user", "-created_at"], name="common_user_user_id_6a8f0d_idx")]
