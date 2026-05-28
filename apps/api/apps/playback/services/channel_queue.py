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

# Upper bound for one shuffle: larger pools mean huge SQL IN lists, ORM memory, and
# thousands of queue rows in one request — keep this conservative unless you tune the DB.
MAX_SHUFFLE_TRACKS = 3_000
_BULK_CHUNK = 400


def _tracks_by_id_map(ids: list[int]) -> dict[int, Track]:
    """Fetch tracks in chunks to avoid one massive IN clause and row materialization spike."""
    out: dict[int, Track] = {}
    for i in range(0, len(ids), _BULK_CHUNK):
        chunk = ids[i : i + _BULK_CHUNK]
        for t in Track.objects.filter(id__in=chunk).select_related("owner"):
            out[t.id] = t
    return out


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


def pick_shuffled_tracks(
    user: AbstractUser,
    channel: Channel,
    limit: int | None = None,
    *,
    anti_repeat_window: int = 0,
    weighted_bias: float = 0.0,
) -> list[Track]:
    """Random order. ``limit`` None or <= 0 = use all accessible tracks (up to MAX_SHUFFLE_TRACKS)."""
    qs = tracks_accessible_to_user(user)
    ids = list(qs.values_list("id", flat=True))
    if not ids:
        return []
    if anti_repeat_window > 0:
        from apps.playback.models import PlaybackEvent

        recent_ids = list(
            PlaybackEvent.objects.filter(channel=channel, track_id__isnull=False)
            .exclude(track_id=0)
            .order_by("-id")
            .values_list("track_id", flat=True)[:anti_repeat_window]
        )
        recent_set = {int(i) for i in recent_ids if i}
        filtered = [i for i in ids if i not in recent_set]
        if filtered:
            ids = filtered
    if weighted_bias > 0:
        track_map = _tracks_by_id_map(ids)
        scored = []
        for tid in ids:
            t = track_map.get(tid)
            tag_count = len(getattr(t, "tags", []) or []) if t else 0
            weight = 1.0 + max(0.0, weighted_bias) * min(5.0, float(tag_count))
            scored.append((random.random() * weight, tid))
        scored.sort(reverse=True, key=lambda x: x[0])
        ids = [tid for _, tid in scored]
    else:
        random.shuffle(ids)
    if limit is None or limit <= 0:
        cap = min(len(ids), MAX_SHUFFLE_TRACKS)
    else:
        cap = min(int(limit), len(ids), MAX_SHUFFLE_TRACKS)
    chosen = ids[: max(1, cap)]
    track_map = _tracks_by_id_map(chosen)
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
    for i in range(0, len(rows), _BULK_CHUNK):
        ChannelQueueItem.objects.bulk_create(rows[i : i + _BULK_CHUNK])
    return list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))


def apply_track_to_session(playback_session: PlaybackSession, track: Track | None) -> None:
    playback_session.track = track
    playback_session.is_playing = True
    playback_session.started_at_server_time = time.time()
    playback_session.paused_at_position = 0
    playback_session.queue_version += 1


def insert_track_after_now_playing(
    channel: Channel,
    track: Track,
    *,
    added_by_id: int | None,
) -> list[ChannelQueueItem]:
    """
    Insert an approved suggestion once, directly after the now-playing row.
    Removes duplicate copies of the same track from the upcoming tail.
    """
    from apps.playback.services.queue_advance import find_current_queue_index

    playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
    rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
    current_idx = find_current_queue_index(rows, playback_session.track_id)
    track_id = track.id

    if current_idx + 1 < len(rows) and rows[current_idx + 1].track_id == track_id:
        return rows

    head = rows[: current_idx + 1]
    tail = [row for row in rows[current_idx + 1 :] if row.track_id != track_id]

    new_row = ChannelQueueItem(channel=channel, track=track, position=0, added_by_id=added_by_id)
    rebuilt = head + [new_row] + tail

    ChannelQueueItem.objects.filter(channel=channel).delete()
    if not rebuilt:
        return []
    bulk_rows = [
        ChannelQueueItem(
            channel=channel,
            track=row.track,
            position=index,
            added_by_id=row.added_by_id,
        )
        for index, row in enumerate(rebuilt)
    ]
    for i in range(0, len(bulk_rows), _BULK_CHUNK):
        ChannelQueueItem.objects.bulk_create(bulk_rows[i : i + _BULK_CHUNK])
    return list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))


def rebalance_queue_premium_boost(*, channel: Channel, current_track_id: int | None) -> list[ChannelQueueItem]:
    """Stable-sort upcoming queue so tracks owned by premium users play sooner."""
    from apps.common.premium_limits import track_owner_is_premium
    from apps.playback.services.queue_advance import find_current_queue_index

    rows = list(
        ChannelQueueItem.objects.filter(channel=channel)
        .select_related("track", "track__owner")
        .order_by("position", "id")
    )
    if len(rows) < 2:
        return rows
    current_idx = find_current_queue_index(rows, current_track_id)
    head = rows[: current_idx + 1]
    tail = rows[current_idx + 1 :]
    if not tail:
        return rows
    premium = [row for row in tail if track_owner_is_premium(row.track)]
    regular = [row for row in tail if not track_owner_is_premium(row.track)]
    if not premium or len(premium) == len(tail):
        return rows
    rebuilt = head + premium + regular
    ChannelQueueItem.objects.filter(channel=channel).delete()
    bulk_rows = [
        ChannelQueueItem(channel=channel, track=row.track, position=index, added_by_id=row.added_by_id)
        for index, row in enumerate(rebuilt)
    ]
    for i in range(0, len(bulk_rows), _BULK_CHUNK):
        ChannelQueueItem.objects.bulk_create(bulk_rows[i : i + _BULK_CHUNK])
    return list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
