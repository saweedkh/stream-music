"""Shared queue + playback helpers for REST and WebSocket paths."""

from __future__ import annotations

import random
import time
from typing import TYPE_CHECKING

from django.db.models import Q

from apps.channels.models import Channel
from apps.playback.models import PlaybackSession
from apps.playlists.models import ChannelQueueItem
from apps.tracks.models import Track

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


def tracks_available_for_controller(user: AbstractUser, channel: Channel):
    """Tracks the DJ can load into the channel queue (matches library visibility rules)."""
    return (
        Track.objects.filter(
            Q(owner=user)
            | Q(visibility=Track.Visibility.PUBLIC_LAN)
            | Q(visibility=Track.Visibility.SHARED_WITH_CHANNELS, share_permissions__channel=channel)
            | Q(visibility=Track.Visibility.SHARED_WITH_USERS, share_permissions__user=user)
        )
        .distinct()
        .select_related("owner")
    )


def pick_shuffled_tracks(user: AbstractUser, channel: Channel, limit: int = 50) -> list[Track]:
    qs = tracks_available_for_controller(user, channel)
    ids = list(qs.values_list("id", flat=True))
    if not ids:
        return []
    random.shuffle(ids)
    chosen = ids[: max(1, min(limit, len(ids)))]
    track_map = {t.id: t for t in Track.objects.filter(id__in=chosen)}
    return [track_map[i] for i in chosen if i in track_map]


def replace_queue_with_tracks(
    *,
    channel: Channel,
    tracks: list[Track],
    user_id: int | None,
) -> list[ChannelQueueItem]:
    ChannelQueueItem.objects.filter(channel=channel).delete()
    if not tracks:
        return []
    rows = [
        ChannelQueueItem(channel=channel, track=t, position=index, added_by_id=user_id) for index, t in enumerate(tracks)
    ]
    ChannelQueueItem.objects.bulk_create(rows)
    return list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))


def apply_track_to_session(playback_session: PlaybackSession, track: Track | None) -> None:
    playback_session.track = track
    playback_session.is_playing = True
    playback_session.started_at_server_time = time.time()
    playback_session.paused_at_position = 0
    playback_session.queue_version += 1
