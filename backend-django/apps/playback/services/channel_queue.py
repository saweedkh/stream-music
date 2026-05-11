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

# Hard cap so one shuffle cannot create an unbounded queue / SQL IN clause.
MAX_SHUFFLE_TRACKS = 15_000


def tracks_accessible_to_user(user: AbstractUser):
    """Same visibility rules as TrackViewSet: own tracks (any visibility), public LAN, user/channel shares."""
    return (
        Track.objects.filter(
            Q(owner=user)
            | Q(visibility=Track.Visibility.PUBLIC_LAN)
            | Q(visibility=Track.Visibility.SHARED_WITH_USERS, share_permissions__user=user)
            | Q(
                visibility=Track.Visibility.SHARED_WITH_CHANNELS,
                share_permissions__channel__memberships__user=user,
            )
        )
        .distinct()
        .select_related("owner")
    )


def tracks_available_for_controller(user: AbstractUser, _channel: Channel):
    """Tracks the DJ can load into the channel queue (library-wide access, not only shares to this channel)."""
    return tracks_accessible_to_user(user)


def pick_shuffled_tracks(user: AbstractUser, _channel: Channel, limit: int | None = None) -> list[Track]:
    """Random order. ``limit`` None or <= 0 = use all accessible tracks (up to MAX_SHUFFLE_TRACKS)."""
    qs = tracks_accessible_to_user(user)
    ids = list(qs.values_list("id", flat=True))
    if not ids:
        return []
    random.shuffle(ids)
    if limit is None or limit <= 0:
        cap = min(len(ids), MAX_SHUFFLE_TRACKS)
    else:
        cap = min(int(limit), len(ids), MAX_SHUFFLE_TRACKS)
    chosen = ids[: max(1, cap)]
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
