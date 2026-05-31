"""Redeem premium invite codes."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import SLUG_PREMIUM
from apps.accounts.models.premium_invite_code import PremiumCodeRedemption, PremiumInviteCode
from apps.accounts.user_badges import assign_badge_slug


class PremiumRedeemError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@transaction.atomic
def redeem_premium_code(user_id: int, raw_code: str) -> dict:
    normalized = str(raw_code or "").strip().upper().replace(" ", "")
    if len(normalized) < 6:
        raise PremiumRedeemError("invalid_code")
    row = PremiumInviteCode.objects.select_for_update().filter(code__iexact=normalized).first()
    if row is None:
        raise PremiumRedeemError("code_not_found")
    if not row.is_valid():
        raise PremiumRedeemError("code_expired_or_exhausted")
    if PremiumCodeRedemption.objects.filter(code_id=row.id, user_id=user_id).exists():
        raise PremiumRedeemError("already_redeemed")
    PremiumCodeRedemption.objects.create(code_id=row.id, user_id=user_id)
    PremiumInviteCode.objects.filter(pk=row.pk).update(use_count=row.use_count + 1)
    assign_badge_slug(user_id, SLUG_PREMIUM)
    return {"ok": True, "is_premium": True, "redeemed_at": timezone.now().isoformat()}
