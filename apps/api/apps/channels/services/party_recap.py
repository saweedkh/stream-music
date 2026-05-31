"""Public party recap aggregation."""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from django.utils import timezone

from apps.channels.models import Channel, ChannelChatMessage, ChannelChatMessageReaction, ChannelTrackReaction
from apps.playback.models import PlaybackEvent


def _build_excitement_heatmap(channel_id: int, rows: list, *, buckets: int = 24) -> dict:
    """Score activity into time buckets for a visual heatmap."""
    if not rows:
        return {"buckets": [], "peak_index": None, "peak_score": 0}

    points: list[tuple[datetime, float]] = []

    for row in rows:
        if hasattr(row, "emitted_at") and row.emitted_at:
            ev = getattr(row, "event_type", "") or ""
            weight = 3.0 if ev in ("next", "skip", "vote_skip") else 2.0 if ev == "play" else 1.0
            points.append((row.emitted_at, weight))

    chat_msgs = ChannelChatMessage.objects.filter(channel_id=channel_id, deleted_at__isnull=True).only(
        "id", "created_at"
    )[:500]
    msg_ids = [m.id for m in chat_msgs]
    msg_times = {m.id: m.created_at for m in chat_msgs if m.created_at}
    if msg_ids:
        for r in ChannelChatMessageReaction.objects.filter(message_id__in=msg_ids).only("message_id", "id"):
            t = msg_times.get(r.message_id)
            if t:
                points.append((t, 1.5))

    for r in ChannelTrackReaction.objects.filter(channel_id=channel_id).only("created_at")[:300]:
        if r.created_at:
            points.append((r.created_at, 2.5))

    if not points:
        return {"buckets": [], "peak_index": None, "peak_score": 0}

    times = [p[0] for p in points]
    t_min = min(times)
    t_max = max(times)
    span = (t_max - t_min).total_seconds() or 1.0
    bucket_scores = [0.0] * buckets
    for t, sc in points:
        idx = min(buckets - 1, int(((t - t_min).total_seconds() / span) * buckets))
        bucket_scores[idx] += sc

    peak_index = max(range(buckets), key=lambda i: bucket_scores[i])
    peak_score = bucket_scores[peak_index]
    max_score = max(bucket_scores) or 1.0
    out_buckets = []
    for i, sc in enumerate(bucket_scores):
        pct = round(100 * sc / max_score) if max_score else 0
        label_min = int((i / buckets) * span // 60)
        out_buckets.append(
            {
                "index": i,
                "score": round(sc, 1),
                "intensity": pct,
                "label": f"+{label_min}m",
            }
        )
    return {"buckets": out_buckets, "peak_index": peak_index, "peak_score": round(peak_score, 1)}


def build_party_recap(channel: Channel, limit: int = 80) -> dict:
    rows = list(
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
    heatmap = _build_excitement_heatmap(channel.id, rows)
    reaction_rows = list(
        ChannelTrackReaction.objects.filter(channel_id=channel.id)
        .select_related("user")
        .order_by("created_at")[:200]
    )
    reaction_timeline = [
        {
            "at": r.created_at.isoformat() if r.created_at else None,
            "emoji": r.emoji,
            "user_id": r.user_id,
            "username": getattr(r.user, "username", "") if r.user_id else "",
            "track_id": r.track_id,
        }
        for r in reaction_rows
    ]
    listener_peaks = []
    if heatmap.get("buckets"):
        for b in heatmap["buckets"]:
            if b["intensity"] >= 70:
                listener_peaks.append(b)
    return {
        "channel_id": channel.id,
        "channel_name": channel.name,
        "description": channel.description,
        "total_events": len(rows),
        "top_tracks": top_tracks,
        "timeline": timeline[-40:],
        "reaction_timeline": reaction_timeline,
        "excitement_heatmap": heatmap,
        "listener_peaks": listener_peaks[:6],
        "generated_at": timezone.now().isoformat(),
    }
