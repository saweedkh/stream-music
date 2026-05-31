"""Build a portable JSON backup of the authenticated user's playlists."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser
from django.utils import timezone

from apps.playlists.models import Playlist, PlaylistItem


def build_playlist_backup_payload(user: AbstractBaseUser) -> dict:
    playlists = (
        Playlist.objects.filter(owner_id=user.id)
        .select_related("channel")
        .order_by("id")
    )
    playlist_ids = list(playlists.values_list("id", flat=True))
    items_by_playlist: dict[int, list[dict]] = {pid: [] for pid in playlist_ids}

    if playlist_ids:
        rows = (
            PlaylistItem.objects.filter(playlist_id__in=playlist_ids)
            .select_related("track")
            .order_by("playlist_id", "position", "id")
        )
        for row in rows:
            tr = row.track
            items_by_playlist[row.playlist_id].append(
                {
                    "position": row.position,
                    "track_id": tr.id,
                    "title": tr.title,
                    "artist": tr.artist or "",
                    "album": tr.album or "",
                    "duration_seconds": tr.duration_seconds,
                    "file_hash": tr.file_hash or "",
                }
            )

    return {
        "format": "stream-music-playlist-backup",
        "version": 1,
        "exported_at": timezone.now().isoformat(),
        "owner_id": user.id,
        "username": getattr(user, "username", ""),
        "playlist_count": len(playlist_ids),
        "playlists": [
            {
                "id": pl.id,
                "name": pl.name,
                "channel_id": pl.channel_id,
                "channel_name": pl.channel.name if pl.channel_id and pl.channel else None,
                "is_auto_generated": pl.is_auto_generated,
                "created_at": pl.created_at.isoformat() if pl.created_at else None,
                "items": items_by_playlist.get(pl.id, []),
            }
            for pl in playlists
        ],
    }
