"""Record referred signups and apply referral codes."""

from __future__ import annotations

from django.db import transaction
from django.db.models import F

from apps.social.models import ReferralCode, ReferralSignup


class ReferralApplyError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@transaction.atomic
def apply_referral_on_signup(*, user_id: int, raw_code: str | None) -> dict | None:
    """Increment referrer signup_count when a valid code is used at registration."""
    code = (raw_code or "").strip().upper()
    if not code:
        return None

    referral = ReferralCode.objects.select_for_update().filter(code__iexact=code).select_related("user").first()
    if referral is None:
        raise ReferralApplyError("invalid_referral_code")
    if referral.user_id == user_id:
        raise ReferralApplyError("cannot_use_own_referral")

    if ReferralSignup.objects.filter(referred_user_id=user_id).exists():
        raise ReferralApplyError("referral_already_applied")

    ReferralSignup.objects.create(referral_code=referral, referred_user_id=user_id)
    ReferralCode.objects.filter(pk=referral.pk).update(signup_count=F("signup_count") + 1)
    referral.refresh_from_db(fields=["signup_count"])

    return {
        "referrer_id": referral.user_id,
        "referrer_username": referral.user.username,
        "code": referral.code,
        "signup_count": referral.signup_count,
    }
