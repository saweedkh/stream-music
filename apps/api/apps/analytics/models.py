"""Channel listen metrics and user gamification."""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.channels.models import Channel
from apps.tracks.models import Track


class ChannelAnalytics(models.Model):
    """Aggregated public stats for a channel (YouTube-style total listen time)."""

    channel = models.OneToOneField(Channel, on_delete=models.CASCADE, related_name="analytics")
    total_listen_seconds = models.PositiveBigIntegerField(default=0)
    total_play_events = models.PositiveIntegerField(default=0)
    unique_listener_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Channel analytics"


class UserChannelListenStat(models.Model):
    """Per-user listen time in a channel (premium detail for owners)."""

    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="user_listen_stats")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_listen_stats"
    )
    listen_seconds = models.PositiveBigIntegerField(default=0)
    play_count = models.PositiveIntegerField(default=0)
    last_listen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("channel", "user")
        indexes = [models.Index(fields=["channel", "-listen_seconds"])]


class ChannelTrackListenStat(models.Model):
    """Listen counts per track within a channel."""

    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="track_listen_stats")
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="channel_listen_stats")
    listen_seconds = models.PositiveBigIntegerField(default=0)
    play_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("channel", "track")
        indexes = [models.Index(fields=["channel", "-listen_seconds"])]


class UserGamificationProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="gamification_profile"
    )
    points = models.PositiveIntegerField(default=0)
    lifetime_listen_seconds = models.PositiveBigIntegerField(default=0)
    streak_days = models.PositiveSmallIntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class GamificationPointEvent(models.Model):
    class Reason(models.TextChoices):
        LISTEN = "listen", "Listen"
        CHAT = "chat", "Chat"
        SUGGESTION = "suggestion", "Suggestion"
        REACTION = "reaction", "Reaction"
        BLIND_GUESS = "blind_guess", "Blind guess"
        REFERRAL = "referral", "Referral"
        DAILY = "daily", "Daily bonus"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="point_events"
    )
    reason = models.CharField(max_length=32, choices=Reason.choices)
    points = models.IntegerField()
    channel = models.ForeignKey(Channel, on_delete=models.SET_NULL, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]
