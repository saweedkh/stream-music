from django.conf import settings
from django.db import models

from apps.channels.models import Channel


class Track(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        SHARED_WITH_USERS = "shared_with_users", "SharedWithUsers"
        SHARED_WITH_CHANNELS = "shared_with_channels", "SharedWithChannels"
        PUBLIC_LAN = "public_lan", "PublicLan"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tracks")
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255, blank=True, default="")
    album = models.CharField(max_length=255, blank=True, default="")
    genre = models.CharField(max_length=120, blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    duration_seconds = models.FloatField(default=0)
    file = models.FileField(upload_to="audio/")
    visibility = models.CharField(max_length=32, choices=Visibility.choices, default=Visibility.PRIVATE)
    created_at = models.DateTimeField(auto_now_add=True)


class TrackSharePermission(models.Model):
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="share_permissions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="shared_tracks"
    )
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, null=True, blank=True, related_name="shared_tracks")
    created_at = models.DateTimeField(auto_now_add=True)
