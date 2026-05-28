import uuid

from django.conf import settings
from django.db import models

from apps.channels.models import Channel
from apps.tracks.models import Track


class PlaylistShareLink(models.Model):
    class Privacy(models.TextChoices):
        PUBLIC = "public", "Public"
        UNLISTED = "unlisted", "Unlisted"

    playlist = models.ForeignKey("Playlist", on_delete=models.CASCADE, related_name="share_links")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    privacy = models.CharField(max_length=16, choices=Privacy.choices, default=Privacy.UNLISTED)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "common_playlistsharelink"
        indexes = [models.Index(fields=["token", "is_active"], name="common_play_token_91ab0d_idx")]


class Playlist(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playlists")
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, null=True, blank=True, related_name="playlists")
    is_auto_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class PlaylistItem(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="items")
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="playlist_items")
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]


class ChannelQueueItem(models.Model):
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="queue_items")
    track = models.ForeignKey(Track, on_delete=models.CASCADE)
    position = models.PositiveIntegerField(default=0)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ChannelQueueUpvote(models.Model):
    """Per-user upvote on a queue item (one per user per item)."""

    queue_item = models.ForeignKey(ChannelQueueItem, on_delete=models.CASCADE, related_name="upvotes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="queue_upvotes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("queue_item", "user")
        indexes = [models.Index(fields=["queue_item", "id"])]
