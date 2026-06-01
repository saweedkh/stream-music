"""Premium activation codes (redeem for badge)."""

from __future__ import annotations

import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def _generate_code() -> str:
    return secrets.token_urlsafe(12).replace("-", "")[:16].upper()


class PremiumInviteCode(models.Model):
    code = models.CharField(max_length=32, unique=True, default=_generate_code)
    max_uses = models.PositiveIntegerField(default=1)
    use_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    note = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_premium_codes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self) -> bool:
        if not self.is_active:
            return False
        if self.use_count >= self.max_uses:
            return False
        if self.expires_at and self.expires_at <= timezone.now():
            return False
        return True


class PremiumCodeRedemption(models.Model):
    code = models.ForeignKey(PremiumInviteCode, on_delete=models.CASCADE, related_name="redemptions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="premium_redemptions")
    redeemed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("code", "user")
