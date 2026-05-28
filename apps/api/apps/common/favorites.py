"""User favorites for tracks and playlists."""

from django.conf import settings
from django.db import models


class UserTrackFavorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="track_favorites")
    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "track")
        indexes = [models.Index(fields=["user", "-created_at"])]


class UserPlaylistFavorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playlist_favorites")
    playlist = models.ForeignKey("playlists.Playlist", on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "playlist")
        indexes = [models.Index(fields=["user", "-created_at"])]
