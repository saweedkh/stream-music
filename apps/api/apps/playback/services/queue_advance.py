"""Shared queue navigation rules (next / prev / auto_next) and playback metadata."""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Literal

from apps.channels.models import Channel
from apps.playlists.models import ChannelQueueItem

Direction = Literal["next", "prev"]
VALID_QUEUE_END_MODES = frozenset({"loop", "stop", "repeat_one"})


def get_queue_end_mode(experience: dict | None) -> str:
    if not isinstance(experience, dict):
        return "loop"
    mode = str(experience.get("queue_end_mode") or "loop").lower().strip()
    return mode if mode in VALID_QUEUE_END_MODES else "loop"


def find_current_queue_index(queue_rows: list[ChannelQueueItem], track_id: int | None) -> int:
    if track_id is None:
        return 0
    for idx, row in enumerate(queue_rows):
        if row.track_id == track_id:
            return idx
    return 0


def resolve_queue_target_index(
    current_index: int,
    queue_len: int,
    direction: Direction,
    mode: str,
) -> int | None:
    """Return next queue index, or None when playback should stop (end of queue, stop mode)."""
    if queue_len <= 0:
        return None
    if mode == "repeat_one":
        return current_index
    if direction == "next":
        nxt = current_index + 1
        if nxt >= queue_len:
            return None if mode == "stop" else 0
        return nxt
    prv = current_index - 1
    if prv < 0:
        return None if mode == "stop" else queue_len - 1
    return prv


def playback_queue_meta(channel: Channel, playback_session, queue_rows: list[ChannelQueueItem] | None = None) -> dict:
    if queue_rows is None:
        queue_rows = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position"))
    idx = find_current_queue_index(queue_rows, playback_session.track_id)
    ex = channel.experience if isinstance(channel.experience, dict) else {}
    meta: dict = {
        "queue_index": idx,
        "queue_length": len(queue_rows),
    }
    pid = ex.get("active_playlist_id")
    if pid is not None:
        meta["playlist_id"] = pid
        pname = ex.get("active_playlist_name")
        if pname:
            meta["playlist_name"] = str(pname)
    return meta


def set_active_playlist(channel: Channel, playlist_id: int, playlist_name: str = "") -> None:
    ex = dict(channel.experience or {})
    ex["active_playlist_id"] = int(playlist_id)
    if playlist_name:
        ex["active_playlist_name"] = playlist_name
    channel.experience = ex
    channel.save(update_fields=["experience", "updated_at"])


def set_playback_source(channel: Channel, source: str) -> None:
    ex = dict(channel.experience or {})
    ex["playback_source"] = source
    channel.experience = ex
    channel.save(update_fields=["experience", "updated_at"])


def clear_active_playlist(channel: Channel) -> None:
    ex = dict(channel.experience or {})
    changed = False
    for key in ("active_playlist_id", "active_playlist_name"):
        if key in ex:
            ex.pop(key, None)
            changed = True
    if "playback_source" in ex:
        ex.pop("playback_source", None)
        changed = True
    if changed:
        channel.experience = ex
        channel.save(update_fields=["experience", "updated_at"])


def scheduled_start_blocks_playback(channel: Channel) -> tuple[bool, str | None]:
    """True when scheduled_start_at is still in the future (ISO-8601 string in experience)."""
    ex = channel.experience if isinstance(channel.experience, dict) else {}
    raw = ex.get("scheduled_start_at")
    if not raw:
        return False, None
    try:
        text = str(raw).strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        when = datetime.fromisoformat(text)
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        if when > now:
            return True, when.isoformat()
    except (TypeError, ValueError):
        return False, None
    return False, None


def apply_queue_advance(
    channel: Channel,
    playback_session,
    queue_rows: list[ChannelQueueItem],
    direction: Direction,
) -> int | None:
    """
    Mutate playback_session for queue navigation.
    Returns target index, or None when playback should pause (stop at end).
    """
    mode = get_queue_end_mode(channel.experience if isinstance(channel.experience, dict) else {})
    current_index = find_current_queue_index(queue_rows, playback_session.track_id)
    target = resolve_queue_target_index(current_index, len(queue_rows), direction, mode)
    if target is None:
        playback_session.is_playing = False
        if playback_session.track and playback_session.started_at_server_time is not None:
            elapsed = max(0.0, time.time() - float(playback_session.started_at_server_time))
            playback_session.paused_at_position = elapsed
        return None
    playback_session.track = queue_rows[target].track
    playback_session.is_playing = True
    playback_session.started_at_server_time = time.time()
    playback_session.paused_at_position = 0
    return target
