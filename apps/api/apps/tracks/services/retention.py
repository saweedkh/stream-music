"""Track storage retention policies."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.playback.models import PlaybackEvent
from apps.tracks.models import Track


def cleanup_unused_tracks(*, dry_run: bool = False) -> dict:
    days = int(getattr(settings, "TRACK_RETENTION_UNUSED_DAYS", 180))
    cutoff = timezone.now() - timedelta(days=days)
    qs = Track.objects.filter(created_at__lt=cutoff, visibility=Track.Visibility.PRIVATE)
    stale_ids = []
    for track in qs.iterator(chunk_size=100):
        used = PlaybackEvent.objects.filter(track_id=track.id).exists()
        if not used:
            stale_ids.append(track.id)
    if dry_run:
        return {"would_delete": len(stale_ids), "days": days}
    deleted = 0
    for tid in stale_ids:
        Track.objects.filter(id=tid).delete()
        deleted += 1
    return {"deleted": deleted, "days": days}
