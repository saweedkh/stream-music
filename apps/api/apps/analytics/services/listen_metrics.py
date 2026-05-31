"""Record and aggregate channel listen statistics."""

from __future__ import annotations

from django.db.models import F
from django.utils import timezone

from apps.analytics.models import (
    ChannelAnalytics,
    ChannelTrackListenStat,
    UserChannelListenStat,
)
from apps.analytics.services.gamification import award_listen_points
from apps.channels.models import Channel
from apps.tracks.models import Track


def _ensure_channel_analytics(channel_id: int) -> ChannelAnalytics:
    row, _ = ChannelAnalytics.objects.get_or_create(channel_id=channel_id)
    return row


def record_listen_seconds(
    channel_id: int,
    user_id: int,
    seconds: int,
    *,
    track_id: int | None = None,
    count_as_play: bool = False,
) -> None:
    """Increment listen counters (idempotent-ish per heartbeat batch)."""
    sec = max(0, min(int(seconds), 3600))
    if sec <= 0 or not user_id:
        return
    if not Channel.objects.filter(id=channel_id, is_active=True).exists():
        return

    now = timezone.now()
    _ensure_channel_analytics(channel_id)
    ChannelAnalytics.objects.filter(channel_id=channel_id).update(
        total_listen_seconds=F("total_listen_seconds") + sec,
        updated_at=now,
    )
    if count_as_play:
        ChannelAnalytics.objects.filter(channel_id=channel_id).update(
            total_play_events=F("total_play_events") + 1,
        )

    stat, created = UserChannelListenStat.objects.get_or_create(
        channel_id=channel_id,
        user_id=user_id,
        defaults={"listen_seconds": sec, "play_count": 1 if count_as_play else 0, "last_listen_at": now},
    )
    if not created:
        UserChannelListenStat.objects.filter(pk=stat.pk).update(
            listen_seconds=F("listen_seconds") + sec,
            last_listen_at=now,
        )
        if count_as_play:
            UserChannelListenStat.objects.filter(pk=stat.pk).update(play_count=F("play_count") + 1)

    if track_id and Track.objects.filter(id=track_id).exists():
        tstat, tcreated = ChannelTrackListenStat.objects.get_or_create(
            channel_id=channel_id,
            track_id=track_id,
            defaults={"listen_seconds": sec, "play_count": 1 if count_as_play else 0},
        )
        if not tcreated:
            ChannelTrackListenStat.objects.filter(pk=tstat.pk).update(
                listen_seconds=F("listen_seconds") + sec,
            )
            if count_as_play:
                ChannelTrackListenStat.objects.filter(pk=tstat.pk).update(play_count=F("play_count") + 1)

    award_listen_points(user_id, sec, channel_id=channel_id)
    _refresh_unique_listeners(channel_id)


def _refresh_unique_listeners(channel_id: int) -> None:
    count = UserChannelListenStat.objects.filter(channel_id=channel_id, listen_seconds__gt=0).count()
    ChannelAnalytics.objects.filter(channel_id=channel_id).update(unique_listener_count=count)


def on_playback_event(
    channel_id: int,
    event_type: str,
    *,
    actor_id: int | None,
    track_id: int | None,
    payload: dict | None,
) -> None:
    """Derive listen seconds from WS playback events when clients report position."""
    if not actor_id:
        return
    data = payload or {}
    if event_type in {"pause", "next", "skip"}:
        pos = data.get("listen_seconds") or data.get("position")
        if pos is not None:
            try:
                seconds = int(float(pos))
            except (TypeError, ValueError):
                seconds = 0
            if seconds > 0:
                record_listen_seconds(
                    channel_id, actor_id, seconds, track_id=track_id, count_as_play=False
                )
    elif event_type == "play":
        record_listen_seconds(channel_id, actor_id, 0, track_id=track_id, count_as_play=True)
