"""Restore playlists from JSON backup export."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser
from django.db import transaction

from apps.playlists.models import Playlist, PlaylistItem
from apps.tracks.models import Track


class BackupImportError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def import_playlist_backup(user: AbstractBaseUser, data: dict) -> dict:
    if data.get("format") != "stream-music-playlist-backup":
        raise BackupImportError("invalid_format")
    if int(data.get("version") or 0) != 1:
        raise BackupImportError("unsupported_version")

    created_playlists = 0
    created_items = 0
    skipped_items = 0
    errors: list[str] = []

    playlists = data.get("playlists")
    if not isinstance(playlists, list):
        raise BackupImportError("invalid_payload")

    with transaction.atomic():
        for pl_data in playlists:
            if not isinstance(pl_data, dict):
                continue
            name = str(pl_data.get("name") or "Imported playlist")[:255]
            channel_id = pl_data.get("channel_id")
            if channel_id is not None:
                channel_id = None  # never re-bind channel on import (safety)

            playlist = Playlist.objects.create(
                owner_id=user.id,
                name=name,
                channel_id=channel_id,
                is_auto_generated=False,
            )
            created_playlists += 1

            items = pl_data.get("items")
            if not isinstance(items, list):
                continue
            for idx, item in enumerate(items):
                if not isinstance(item, dict):
                    skipped_items += 1
                    continue
                track = _resolve_track(user.id, item)
                if track is None:
                    skipped_items += 1
                    errors.append(f"track_not_found:{item.get('title', '?')}")
                    continue
                pos = int(item.get("position") if item.get("position") is not None else idx)
                PlaylistItem.objects.create(playlist=playlist, track=track, position=pos)
                created_items += 1

    return {
        "ok": True,
        "created_playlists": created_playlists,
        "created_items": created_items,
        "skipped_items": skipped_items,
        "errors": errors[:50],
    }


def _resolve_track(user_id: int, item: dict) -> Track | None:
    file_hash = str(item.get("file_hash") or "").strip()
    if file_hash:
        found = Track.objects.filter(owner_id=user_id, file_hash=file_hash).first()
        if found:
            return found
    track_id = item.get("track_id")
    if track_id:
        found = Track.objects.filter(owner_id=user_id, id=int(track_id)).first()
        if found:
            return found
    title = str(item.get("title") or "").strip()
    artist = str(item.get("artist") or "").strip()
    if title:
        qs = Track.objects.filter(owner_id=user_id, title__iexact=title)
        if artist:
            qs = qs.filter(artist__iexact=artist)
        return qs.first()
    return None
