"""Extra public profile sections: live channels, party highlights, activity."""

from __future__ import annotations

from django.contrib.auth.models import User

from apps.channels.services.party_recap import build_party_recap
from apps.discovery.selectors import channel_is_live, public_channel_queryset
from apps.social.models import ActivityEvent


def live_public_channels_for_user(user_id: int, request) -> list[dict]:
    from apps.channels.serializers.channel_serializers import ChannelSerializer

    owned = public_channel_queryset().filter(owner_id=user_id).select_related("owner")
    live = [ch for ch in owned if channel_is_live(ch)][:12]
    return ChannelSerializer(live, many=True, context={"request": request}).data


def party_recap_highlights_for_user(user_id: int, *, limit: int = 5) -> list[dict]:
    channels = public_channel_queryset().filter(owner_id=user_id).order_by("-id")[:limit]
    highlights = []
    for ch in channels:
        recap = build_party_recap(ch)
        top = recap.get("top_tracks") or []
        highlights.append(
            {
                "channel_id": ch.id,
                "channel_name": ch.name,
                "top_tracks": top[:3],
                "total_events": recap.get("total_events", 0),
            }
        )
    return highlights


def recent_activity_for_user(user_id: int, *, limit: int = 15) -> list[dict]:
    rows = (
        ActivityEvent.objects.filter(actor_id=user_id)
        .select_related("channel")
        .order_by("-created_at")[:limit]
    )
    return [
        {
            "kind": r.kind,
            "channel_id": r.channel_id,
            "channel_name": r.channel.name if r.channel_id and r.channel else None,
            "metadata": r.metadata if isinstance(r.metadata, dict) else {},
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
