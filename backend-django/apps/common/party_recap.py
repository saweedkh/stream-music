"""Public party recap aggregation."""

from __future__ import annotations

from collections import Counter

from apps.channels.models import Channel
from apps.playback.models import PlaybackEvent


def build_party_recap(channel: Channel, limit: int = 80) -> dict:
    rows = (
        PlaybackEvent.objects.filter(channel_id=channel.id, track_id__isnull=False)
        .select_related("track")
        .order_by("-id")[:limit]
    )
    plays = Counter()
    for row in rows:
        if row.track_id and row.track:
            plays[row.track_id] = plays[row.track_id] + 1
    top = plays.most_common(8)
    top_tracks = []
    track_by_id = {r.track_id: r.track for r in rows if r.track_id and r.track}
    for tid, count in top:
        t = track_by_id.get(tid)
        if t:
            top_tracks.append({"id": t.id, "title": t.title, "artist": t.artist, "play_count": count})
    timeline = [
        {
            "track_id": r.track_id,
            "title": r.track.title if r.track else None,
            "event_type": r.event_type,
            "at": r.emitted_at.isoformat(),
        }
        for r in reversed(list(rows))
    ]
    return {
        "channel_id": channel.id,
        "channel_name": channel.name,
        "description": channel.description,
        "total_events": len(rows),
        "top_tracks": top_tracks,
        "timeline": timeline[-40:],
    }
