"""Read-only analytics queries."""

from __future__ import annotations

from apps.accounts.premium_limits import user_has_premium
from apps.analytics.models import ChannelAnalytics, ChannelTrackListenStat, UserChannelListenStat
from apps.channels.models import Channel
from apps.channels.permissions import can_manage_channel


def get_or_create_channel_analytics(channel_id: int) -> ChannelAnalytics:
    row, _ = ChannelAnalytics.objects.get_or_create(channel_id=channel_id)
    return row


def build_public_channel_stats(channel_id: int) -> dict:
    row = get_or_create_channel_analytics(channel_id)
    return {
        "channel_id": channel_id,
        "total_listen_seconds": row.total_listen_seconds,
        "total_listen_hours": round(row.total_listen_seconds / 3600, 2),
        "total_play_events": row.total_play_events,
        "unique_listeners": row.unique_listener_count,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def build_detailed_channel_stats(channel_id: int, user) -> dict | None:
    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return None
    if (
        not can_manage_channel(user, channel_id)
        and channel.owner_id != user.id
        and not user_has_premium(user)
    ):
        return None
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
        "premium_detail": True,
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
            }
            for r in top_listeners
        ],
    }
