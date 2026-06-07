"""Platform-wide analytics aggregates for admin."""

from __future__ import annotations

from django.db.models import Count, Sum
from django.utils import timezone

from apps.analytics.models import (
    ChannelAnalytics,
    GamificationPointEvent,
    UserChannelListenStat,
    UserGamificationProfile,
)
from apps.analytics.selectors import build_public_channel_stats
from apps.channels.models import Channel


def build_platform_analytics_overview() -> dict:
    agg = ChannelAnalytics.objects.aggregate(
        total_listen_seconds=Sum("total_listen_seconds"),
        total_play_events=Sum("total_play_events"),
        channels_with_stats=Count("id"),
    )
    total_listen_seconds = int(agg["total_listen_seconds"] or 0)
    unique_listeners = UserChannelListenStat.objects.values("user_id").distinct().count()
    gam_agg = UserGamificationProfile.objects.aggregate(
        profiles_total=Count("id"),
        total_points=Sum("points"),
    )
    since_30d = timezone.now() - timezone.timedelta(days=30)
    point_events_30d = GamificationPointEvent.objects.filter(created_at__gte=since_30d).count()
    active_streaks = UserGamificationProfile.objects.filter(streak_days__gt=0).count()

    top_rows = (
        ChannelAnalytics.objects.select_related("channel", "channel__owner")
        .order_by("-total_listen_seconds")[:5]
    )
    top_channels = []
    for row in top_rows:
        ch = row.channel
        top_channels.append(
            {
                "channel_id": ch.id,
                "channel_name": ch.name,
                "owner_username": ch.owner.username if ch.owner_id else None,
                "total_listen_seconds": row.total_listen_seconds,
                "total_listen_hours": round(row.total_listen_seconds / 3600, 2),
                "total_play_events": row.total_play_events,
                "unique_listeners": row.unique_listener_count,
            }
        )

    return {
        "listen": {
            "total_listen_seconds": total_listen_seconds,
            "total_listen_hours": round(total_listen_seconds / 3600, 2),
            "total_play_events": int(agg["total_play_events"] or 0),
            "channels_with_stats": int(agg["channels_with_stats"] or 0),
            "unique_listeners_platform": unique_listeners,
        },
        "gamification": {
            "profiles_total": int(gam_agg["profiles_total"] or 0),
            "total_points_awarded": int(gam_agg["total_points"] or 0),
            "active_streaks": active_streaks,
            "point_events_30d": point_events_30d,
        },
        "top_channels": top_channels,
    }


def list_channel_analytics(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = ChannelAnalytics.objects.select_related("channel", "channel__owner").order_by("-total_listen_seconds")
    if search:
        qs = qs.filter(Q(channel__name__icontains=search) | Q(channel__owner__username__icontains=search))
    total = qs.count()
    rows = list(qs[offset : offset + limit])
    results = []
    for row in rows:
        ch = row.channel
        results.append(
            {
                "channel_id": ch.id,
                "channel_name": ch.name,
                "owner_id": ch.owner_id,
                "owner_username": ch.owner.username if ch.owner_id else None,
                "total_listen_seconds": row.total_listen_seconds,
                "total_listen_hours": round(row.total_listen_seconds / 3600, 2),
                "total_play_events": row.total_play_events,
                "unique_listeners": row.unique_listener_count,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
        )
    return results, total


def build_admin_channel_analytics_detail(channel_id: int) -> dict | None:
    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return None
    from apps.analytics.models import ChannelTrackListenStat, UserChannelListenStat

    public = build_public_channel_stats(channel_id)
    top_tracks = list(
        ChannelTrackListenStat.objects.filter(channel_id=channel_id)
        .select_related("track")
        .order_by("-listen_seconds")[:15]
    )
    top_listeners = list(
        UserChannelListenStat.objects.filter(channel_id=channel_id)
        .select_related("user")
        .order_by("-listen_seconds")[:20]
    )
    return {
        **public,
        "channel_name": channel.name,
        "owner_username": channel.owner.username if channel.owner_id else None,
        "top_tracks": [
            {
                "track_id": r.track_id,
                "title": r.track.title if r.track else "",
                "artist": r.track.artist if r.track else "",
                "listen_seconds": r.listen_seconds,
                "play_count": r.play_count,
            }
            for r in top_tracks
        ],
        "top_listeners": [
            {
                "user_id": r.user_id,
                "username": getattr(r.user, "username", ""),
                "listen_seconds": r.listen_seconds,
                "play_count": r.play_count,
                "last_listen_at": r.last_listen_at.isoformat() if r.last_listen_at else None,
            }
            for r in top_listeners
        ],
    }


def list_gamification_profiles(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = UserGamificationProfile.objects.select_related("user").order_by("-points", "-lifetime_listen_seconds")
    if search:
        qs = qs.filter(user__username__icontains=search)
    total = qs.count()
    results = []
    for row in qs[offset : offset + limit]:
        level = max(1, row.points // 500 + 1)
        results.append(
            {
                "user_id": row.user_id,
                "username": row.user.username,
                "points": row.points,
                "level": level,
                "streak_days": row.streak_days,
                "lifetime_listen_hours": round(row.lifetime_listen_seconds / 3600, 2),
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
        )
    return results, total
