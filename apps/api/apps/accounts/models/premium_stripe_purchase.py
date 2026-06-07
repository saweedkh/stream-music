"""Stripe Checkout purchase audit rows."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class PremiumStripePurchase(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="stripe_premium_purchases",
    )
    stripe_session_id = models.CharField(max_length=255, unique=True, db_index=True)
    amount_total = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=8, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "-created_at"])]
