"""Playlist mutations (bulk add, copy, assign, reorder)."""

from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth.models import AbstractBaseUser
from django.db import transaction
from django.db.models import Max

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import Channel
from apps.channels.permissions import can_copy_playlist_to_channel, can_manage_channel
from apps.playback.services.channel_queue import tracks_accessible_to_user
from apps.playlists.models import Playlist, PlaylistItem
from apps.playlists.selectors import PLAYLIST_BULK_ADD_MAX, playlist_inaccessible_track_ids


@dataclass
class BulkAddResult:
    added: int
    requested: int
    skipped_not_allowed: int


def parse_track_id_list(raw_ids: list) -> tuple[list[int] | None, str | None]:
    """Return (ordered_unique_ids, error_detail)."""
    if not isinstance(raw_ids, list) or len(raw_ids) == 0:
        return None, "track_ids_required"
    if len(raw_ids) > PLAYLIST_BULK_ADD_MAX:
        return None, "too_many_tracks"
    parsed: list[int] = []
    for x in raw_ids:
        try:
            parsed.append(int(x))
        except (TypeError, ValueError):
            return None, "invalid_track_id"
    seen: set[int] = set()
    ordered_unique: list[int] = []
    for tid in parsed:
        if tid in seen:
            continue
        seen.add(tid)
        ordered_unique.append(tid)
    return ordered_unique, None


def bulk_add_tracks_to_playlist(
    user: AbstractBaseUser, playlist: Playlist, raw_ids: list
) -> tuple[BulkAddResult | None, str | None, int | None]:
    """
    Add tracks to playlist. Returns (result, error_detail, max_hint for too_many).
    """
    ordered_unique, err = parse_track_id_list(raw_ids)
    if err == "too_many_tracks":
        return None, err, PLAYLIST_BULK_ADD_MAX
    if err:
        return None, err, None
    assert ordered_unique is not None
    allowed = set(tracks_accessible_to_user(user).filter(id__in=ordered_unique).values_list("id", flat=True))
    to_add = [tid for tid in ordered_unique if tid in allowed]
    with transaction.atomic():
        base = playlist.items.aggregate(m=Max("position"))["m"]
        start = 0 if base is None else int(base) + 1
        rows = [PlaylistItem(playlist=playlist, track_id=tid, position=start + i) for i, tid in enumerate(to_add)]
        if rows:
            PlaylistItem.objects.bulk_create(rows)
    return (
        BulkAddResult(
            added=len(to_add),
            requested=len(raw_ids),
            skipped_not_allowed=len(ordered_unique) - len(to_add),
        ),
        None,
        None,
    )


@dataclass
class CopyToChannelResult:
    playlist: Playlist
    added: int
    skipped_inaccessible: int


def copy_playlist_to_channel(
    user: AbstractBaseUser,
    source: Playlist,
    channel_id: int,
    *,
    name: str,
) -> tuple[CopyToChannelResult | None, str | None, int | None]:
    """Returns (result, error_detail, http_status)."""
    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return None, "not_found", 404
    if not channel.is_active:
        return None, "channel_closed", 403
    if not can_copy_playlist_to_channel(user, source, channel_id):
        return None, "permission_denied", 403
    blocked = set(playlist_inaccessible_track_ids(user, source))
    with transaction.atomic():
        dest = Playlist.objects.create(name=name[:255], owner=user, channel_id=channel_id)
        items = list(PlaylistItem.objects.filter(playlist=source).order_by("position", "id"))
        allowed_rows = [row for row in items if row.track_id not in blocked]
        if allowed_rows:
            PlaylistItem.objects.bulk_create(
                [
                    PlaylistItem(playlist=dest, track_id=row.track_id, position=idx)
                    for idx, row in enumerate(allowed_rows)
                ]
            )
    return (
        CopyToChannelResult(
            playlist=dest,
            added=len(allowed_rows) if items else 0,
            skipped_inaccessible=len(blocked),
        ),
        None,
        None,
    )


def assign_playlist_to_channel(
    user: AbstractBaseUser,
    source: Playlist,
    channel_id: int,
) -> tuple[Playlist | None, str | None, int | None]:
    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return None, "not_found", 404
    if not channel.is_active:
        return None, "channel_closed", 403
    if not can_manage_channel(user, channel_id):
        return None, "permission_denied", 403
    if source.channel_id is not None:
        return None, "playlist_already_on_channel", 400
    if source.owner_id != user.id and not is_platform_superuser(user):
        return None, "playlist_assign_owner_only", 403
    blocked = playlist_inaccessible_track_ids(user, source)
    if blocked:
        return None, "playlist_has_inaccessible_tracks", 400
    source.channel_id = channel_id
    source.save(update_fields=["channel_id"])
    return source, None, None


def reorder_playlist_item(item: PlaylistItem, new_position: int) -> PlaylistItem:
    new_position = max(0, int(new_position))
    rows = list(PlaylistItem.objects.filter(playlist=item.playlist).order_by("position", "id"))
    rows = [row for row in rows if row.id != item.id]
    if new_position > len(rows):
        new_position = len(rows)
    rows.insert(new_position, item)
    for index, row in enumerate(rows):
        if row.position != index:
            row.position = index
            row.save(update_fields=["position"])
    item.refresh_from_db()
    return item
