"""Stripe Checkout for one-time premium activation."""

from __future__ import annotations

import logging

from django.conf import settings

from apps.accounts.models import SLUG_PREMIUM
from apps.accounts.user_badges import assign_badge_slug

logger = logging.getLogger(__name__)


class StripePremiumError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def stripe_configured() -> bool:
    return bool(
        getattr(settings, "STRIPE_SECRET_KEY", "").strip()
        and getattr(settings, "STRIPE_PRICE_ID", "").strip()
    )


def grant_premium_from_stripe(user_id: int, *, session_id: str | None = None) -> dict:
    assign_badge_slug(user_id, SLUG_PREMIUM)
    return {"ok": True, "is_premium": True, "session_id": session_id}


def create_premium_checkout_session(user_id: int, *, username: str, success_url: str, cancel_url: str) -> dict:
    if not stripe_configured():
        raise StripePremiumError("stripe_not_configured")
    try:
        import stripe
    except ImportError as exc:
        raise StripePremiumError("stripe_sdk_missing") from exc

    stripe.api_key = settings.STRIPE_SECRET_KEY.strip()
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"price": settings.STRIPE_PRICE_ID.strip(), "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=str(user_id),
        metadata={"user_id": str(user_id), "username": username[:64]},
    )
    if not session.url:
        raise StripePremiumError("checkout_failed")
    return {"checkout_url": session.url, "session_id": session.id}


def handle_stripe_webhook_payload(payload: bytes, sig_header: str | None) -> dict:
    if not stripe_configured():
        raise StripePremiumError("stripe_not_configured")
    secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise StripePremiumError("webhook_secret_missing")
    try:
        import stripe
    except ImportError as exc:
        raise StripePremiumError("stripe_sdk_missing") from exc

    stripe.api_key = settings.STRIPE_SECRET_KEY.strip()
    try:
        event = stripe.Webhook.construct_event(payload, sig_header or "", secret)
    except Exception as exc:
        logger.warning("stripe webhook verify failed: %s", exc)
        raise StripePremiumError("invalid_signature") from exc

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata") or {}
        user_id = int(meta.get("user_id") or session.get("client_reference_id") or 0)
        if user_id:
            grant_premium_from_stripe(user_id, session_id=session.get("id"))
            return {"handled": True, "user_id": user_id}
    return {"handled": False, "type": event.get("type")}
