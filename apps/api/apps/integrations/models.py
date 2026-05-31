"""Webhooks and API tokens for self-hosted integrations."""

from __future__ import annotations

import secrets

from django.conf import settings
from django.db import models


def _webhook_secret() -> str:
    return secrets.token_urlsafe(32)


def _api_token() -> str:
    return secrets.token_urlsafe(40)


class WebhookSubscription(models.Model):
    class Event(models.TextChoices):
        CHANNEL_LIVE = "channel.live", "Channel went live"
        CHANNEL_STOPPED = "channel.stopped", "Channel stopped playing"
        PLAYLIST_SHUFFLE = "channel.shuffle", "Playlist shuffle"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="webhook_subscriptions"
    )
    url = models.URLField(max_length=500)
    secret = models.CharField(max_length=64, default=_webhook_secret)
    events = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_delivery_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=["owner", "is_active"])]


class WebhookDeliveryLog(models.Model):
    subscription = models.ForeignKey(WebhookSubscription, on_delete=models.CASCADE, related_name="deliveries")
    event = models.CharField(max_length=64)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    success = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class UserApiToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_tokens")
    name = models.CharField(max_length=120, default="default")
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    token_prefix = models.CharField(max_length=12)
    scopes = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    @staticmethod
    def hash_token(raw: str) -> str:
        import hashlib

        return hashlib.sha256(raw.encode()).hexdigest()
