import uuid

from django.conf import settings
from django.db import models


class UserPublicProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="public_profile",
    )
    bio = models.CharField(max_length=500, blank=True, default="")
    is_public = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile({self.user_id})"


class PlaylistShareLink(models.Model):
    class Privacy(models.TextChoices):
        PUBLIC = "public", "Public"
        UNLISTED = "unlisted", "Unlisted"

    playlist = models.ForeignKey("playlists.Playlist", on_delete=models.CASCADE, related_name="share_links")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    privacy = models.CharField(max_length=16, choices=Privacy.choices, default=Privacy.UNLISTED)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["token", "is_active"])]


class ChannelFollow(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_follows")
    channel = models.ForeignKey("channels.Channel", on_delete=models.CASCADE, related_name="followers")
    notify_live = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "channel")
        indexes = [models.Index(fields=["channel", "user"])]
