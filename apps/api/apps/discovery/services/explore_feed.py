"""Build explore feed payload."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.channels.models import Channel
from apps.common.serializers import ChannelSerializer, PlaylistSerializer
from apps.playlists.models import PlaylistShareLink
from apps.discovery.selectors import channel_is_live, explore_channel_matches, public_channel_queryset
from apps.playback.models import PlaybackEvent
from apps.playlists.models import PlaylistItem


def build_explore_feed(request, *, q: str, lang: str, genre: str, live_only: bool) -> dict:
    live = []
    for ch in public_channel_queryset().order_by("-updated_at")[:80]:
        if not explore_channel_matches(ch, q=q, lang=lang, genre=genre):
            continue
        if channel_is_live(ch):
            live.append(ChannelSerializer(ch, context={"request": request}).data)
    if live_only:
        return {"live_channels": live, "popular_channels": [], "shared_playlists": []}

    week_ago = timezone.now() - timedelta(days=7)
    event_counts = (
        PlaybackEvent.objects.filter(
            channel__privacy=Channel.Privacy.PUBLIC,
            channel__is_active=True,
            emitted_at__gte=week_ago,
            track_id__isnull=False,
        )
        .values("channel_id")
        .annotate(n=Count("id"))
        .order_by("-n")[:12]
    )
    popular_ids = [row["channel_id"] for row in event_counts]
    popular_map = {c.id: c for c in public_channel_queryset().filter(id__in=popular_ids)}
    popular = []
    for cid in popular_ids:
        ch = popular_map.get(cid)
        if ch and explore_channel_matches(ch, q=q, lang=lang, genre=genre):
            popular.append(
                {
                    "channel": ChannelSerializer(ch, context={"request": request}).data,
                    "event_count": next(r["n"] for r in event_counts if r["channel_id"] == cid),
                }
            )

    share_links = (
        PlaylistShareLink.objects.filter(is_active=True, privacy=PlaylistShareLink.Privacy.PUBLIC)
        .select_related("playlist", "playlist__owner")
        .order_by("-created_at")[:24]
    )
    shared_playlists = []
    now = timezone.now()
    for link in share_links:
        if link.expires_at and link.expires_at < now:
            continue
        pl = link.playlist
        if pl.channel_id is not None:
            continue
        shared_playlists.append(
            {
                "token": str(link.token),
                "share_url": f"/share/playlist/{link.token}",
                "playlist": PlaylistSerializer(pl, context={"request": request}).data,
                "owner_username": pl.owner.username,
                "item_count": PlaylistItem.objects.filter(playlist=pl).count(),
            }
        )

    return {
        "live_channels": live,
        "popular_channels": popular,
        "shared_playlists": shared_playlists,
    }
