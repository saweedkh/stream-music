"""Billing and premium admin queries."""

from __future__ import annotations

from datetime import datetime, timedelta, time

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import PremiumCodeRedemption, PremiumInviteCode, PremiumStripePurchase, SLUG_PREMIUM
from apps.accounts.models.user_badge_assignment import UserBadgeAssignment
from apps.accounts.services.stripe_premium import stripe_configured
from apps.admin_panel.selectors.date_range import filter_created_at
from apps.social.models import ReferralSignup


def _stripe_qs(*, date_from: str = "", date_to: str = ""):
    return filter_created_at(PremiumStripePurchase.objects.all(), date_from=date_from, date_to=date_to)


def _referral_signup_qs(*, date_from: str = "", date_to: str = ""):
    return filter_created_at(ReferralSignup.objects.all(), date_from=date_from, date_to=date_to)


def build_billing_overview(*, date_from: str = "", date_to: str = "") -> dict:
    premium_users = UserBadgeAssignment.objects.filter(badge__slug=SLUG_PREMIUM, badge__is_active=True).count()
    stripe_qs = _stripe_qs(date_from=date_from, date_to=date_to)
    stripe_purchases = stripe_qs.count()
    stripe_revenue = stripe_qs.aggregate(total=Sum("amount_total"))["total"] or 0
    code_qs = filter_created_at(PremiumCodeRedemption.objects.all(), date_from=date_from, date_to=date_to)
    code_redemptions = code_qs.count()
    active_codes = PremiumInviteCode.objects.filter(is_active=True).count()
    referral_signups = _referral_signup_qs(date_from=date_from, date_to=date_to).count()
    return {
        "stripe_configured": stripe_configured(),
        "premium_users": premium_users,
        "stripe_purchases": stripe_purchases,
        "stripe_revenue_cents": int(stripe_revenue),
        "code_redemptions": code_redemptions,
        "active_invite_codes": active_codes,
        "referral_signups": referral_signups,
        "trends": build_billing_trends(days=30),
    }


def build_billing_trends(*, days: int = 30) -> dict:
    days = max(7, min(days, 90))
    today = timezone.localdate()
    start_day = today - timedelta(days=days - 1)
    start_dt = timezone.make_aware(datetime.combine(start_day, time.min))

    stripe_rows = (
        PremiumStripePurchase.objects.filter(created_at__gte=start_dt)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"), revenue_cents=Sum("amount_total"))
    )
    referral_rows = (
        ReferralSignup.objects.filter(created_at__gte=start_dt)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
    )

    stripe_by_day = {row["day"]: row for row in stripe_rows}
    referral_by_day = {row["day"]: row for row in referral_rows}

    stripe_trend = []
    referral_trend = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        stripe_row = stripe_by_day.get(day, {})
        referral_row = referral_by_day.get(day, {})
        stripe_trend.append(
            {
                "date": day.isoformat(),
                "count": int(stripe_row.get("count") or 0),
                "revenue_cents": int(stripe_row.get("revenue_cents") or 0),
            }
        )
        referral_trend.append({"date": day.isoformat(), "count": int(referral_row.get("count") or 0)})

    return {"stripe_purchases": stripe_trend, "referral_signups": referral_trend}


def list_stripe_purchases(
    *,
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    qs = _stripe_qs(date_from=date_from, date_to=date_to).select_related("user").order_by("-created_at")
    if search:
        qs = qs.filter(Q(user__username__icontains=search) | Q(stripe_session_id__icontains=search))
    total = qs.count()
    results = []
    for row in qs[offset : offset + limit]:
        results.append(
            {
                "id": row.id,
                "user_id": row.user_id,
                "username": row.user.username,
                "stripe_session_id": row.stripe_session_id,
                "amount_total": row.amount_total,
                "currency": row.currency,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return results, total


def export_stripe_purchases(*, search: str = "", date_from: str = "", date_to: str = "", limit: int = 5000) -> list[list]:
    rows, _ = list_stripe_purchases(search=search, date_from=date_from, date_to=date_to, offset=0, limit=limit)
    return [
        [
            row["id"],
            row["user_id"],
            row["username"],
            row["stripe_session_id"],
            row["amount_total"] if row["amount_total"] is not None else "",
            row["currency"],
            row["created_at"] or "",
        ]
        for row in rows
    ]


def list_premium_users(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = (
        UserBadgeAssignment.objects.filter(badge__slug=SLUG_PREMIUM, badge__is_active=True)
        .select_related("user", "badge")
        .order_by("-id")
    )
    if search:
        qs = qs.filter(user__username__icontains=search)
    total = qs.count()
    results = []
    for row in qs[offset : offset + limit]:
        user = row.user
        stripe_count = PremiumStripePurchase.objects.filter(user_id=user.id).count()
        code_count = PremiumCodeRedemption.objects.filter(user_id=user.id).count()
        results.append(
            {
                "user_id": user.id,
                "username": user.username,
                "email": user.email or "",
                "stripe_purchases": stripe_count,
                "code_redemptions": code_count,
                "source": "stripe" if stripe_count else ("code" if code_count else "manual"),
            }
        )
    return results, total


def list_referral_signups(
    *,
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    qs = _referral_signup_qs(date_from=date_from, date_to=date_to).select_related(
        "referral_code", "referral_code__user", "referred_user"
    ).order_by("-created_at")
    if search:
        qs = qs.filter(
            Q(referral_code__code__icontains=search)
            | Q(referral_code__user__username__icontains=search)
            | Q(referred_user__username__icontains=search)
        )
    total = qs.count()
    results = [
        {
            "id": row.id,
            "code": row.referral_code.code,
            "referrer_id": row.referral_code.user_id,
            "referrer_username": row.referral_code.user.username,
            "referred_user_id": row.referred_user_id,
            "referred_username": row.referred_user.username,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in qs[offset : offset + limit]
    ]
    return results, total


def export_referral_signups(*, search: str = "", date_from: str = "", date_to: str = "", limit: int = 5000) -> list[list]:
    rows, _ = list_referral_signups(search=search, date_from=date_from, date_to=date_to, offset=0, limit=limit)
    return [
        [
            row["id"],
            row["code"],
            row["referrer_id"],
            row["referrer_username"],
            row["referred_user_id"],
            row["referred_username"],
            row["created_at"] or "",
        ]
        for row in rows
    ]
