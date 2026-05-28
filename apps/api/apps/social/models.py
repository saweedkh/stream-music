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
