"""User points, levels, and activity scoring."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.analytics.models import GamificationPointEvent, UserGamificationProfile

POINTS_PER_LISTEN_MINUTE = 2
LEVEL_STEP_POINTS = 500


def level_for_points(points: int) -> int:
    return max(1, 1 + points // LEVEL_STEP_POINTS)


def _profile(user_id: int) -> UserGamificationProfile:
    row, _ = UserGamificationProfile.objects.get_or_create(user_id=user_id)
    return row


def add_points(
    user_id: int,
    points: int,
    reason: str,
    *,
    channel_id: int | None = None,
    metadata: dict | None = None,
) -> UserGamificationProfile:
    pts = int(points)
    if pts == 0:
        return _profile(user_id)
    GamificationPointEvent.objects.create(
        user_id=user_id,
        reason=reason,
        points=pts,
        channel_id=channel_id,
        metadata=metadata or {},
    )
    from django.db.models import F

    prof = _profile(user_id)
    UserGamificationProfile.objects.filter(pk=prof.pk).update(points=F("points") + pts)
    _touch_streak(user_id)
    return UserGamificationProfile.objects.get(pk=prof.pk)


def _touch_streak(user_id: int) -> None:
    today = timezone.localdate()
    prof = _profile(user_id)
    if prof.last_active_date == today:
        return
    if prof.last_active_date == today - timedelta(days=1):
        UserGamificationProfile.objects.filter(pk=prof.pk).update(
            streak_days=prof.streak_days + 1,
            last_active_date=today,
        )
    else:
        UserGamificationProfile.objects.filter(pk=prof.pk).update(streak_days=1, last_active_date=today)


def award_listen_points(user_id: int, seconds: int, *, channel_id: int | None) -> None:
    minutes = max(0, seconds) // 60
    if minutes < 1:
        return
    pts = minutes * POINTS_PER_LISTEN_MINUTE
    from django.db.models import F

    prof = _profile(user_id)
    UserGamificationProfile.objects.filter(pk=prof.pk).update(
        lifetime_listen_seconds=F("lifetime_listen_seconds") + seconds
    )
    add_points(user_id, pts, GamificationPointEvent.Reason.LISTEN, channel_id=channel_id)


def build_gamification_payload(user_id: int) -> dict:
    prof = _profile(user_id)
    since = timezone.now() - timedelta(days=30)
    daily = (
        GamificationPointEvent.objects.filter(user_id=user_id, created_at__gte=since)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(total=Sum("points"))
        .order_by("day")
    )
    chart = [
        {"date": row["day"].isoformat() if row["day"] else "", "points": int(row["total"] or 0)}
        for row in daily
    ]
    return {
        "points": prof.points,
        "level": level_for_points(prof.points),
        "next_level_at": (level_for_points(prof.points)) * LEVEL_STEP_POINTS,
        "streak_days": prof.streak_days,
        "lifetime_listen_hours": round(prof.lifetime_listen_seconds / 3600, 2),
        "points_chart_30d": chart,
    }
