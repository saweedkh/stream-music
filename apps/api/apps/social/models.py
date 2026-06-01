"""Social domain ORM models."""

from __future__ import annotations

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
    avatar = models.FileField(upload_to="avatars/%Y/%m/", null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "common_userpublicprofile"

    def __str__(self):
        return f"Profile({self.user_id})"


class ChannelFollow(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_follows")
    channel = models.ForeignKey("stream_channels.Channel", on_delete=models.CASCADE, related_name="followers")
    notify_live = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "common_channelfollow"
        unique_together = ("user", "channel")

    def __str__(self):
        return f"Follow(user={self.user_id}, channel={self.channel_id})"


class UserFollow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following_users",
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follower_users",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "common_userfollow"
        unique_together = ("follower", "following")
        indexes = [models.Index(fields=["following", "follower"], name="common_user_follow_idx")]

    def __str__(self):
        return f"UserFollow({self.follower_id} -> {self.following_id})"


class ActivityEvent(models.Model):
    """Feed events for followers (shuffle, new playlist, channel live)."""

    class Kind(models.TextChoices):
        CHANNEL_LIVE = "channel_live", "Channel live"
        PLAYLIST_CREATED = "playlist_created", "Playlist created"
        CHANNEL_SHUFFLE = "channel_shuffle", "Channel shuffle"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activity_events"
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    channel = models.ForeignKey(
        "stream_channels.Channel", on_delete=models.CASCADE, null=True, blank=True, related_name="activity_events"
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["-created_at"])]


class ReferralCode(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="referral_code"
    )
    code = models.CharField(max_length=24, unique=True)
    signup_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
