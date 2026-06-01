"""Dashboard channel aggregation."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser

from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import ChannelSerializer
from apps.dashboard.selectors import (
    active_member_channel_ids,
    channels_by_ids,
    manageable_channel_ids,
    pending_suggestion_counts_by_channel,
)
from apps.playback.consumers import _presence_snapshot


def build_online_channels_payload(user: AbstractBaseUser, request) -> dict:
    channel_ids = active_member_channel_ids(user)
    channels = channels_by_ids(channel_ids)
    managed_ids = [cid for cid in channel_ids if can_manage_channel(user, cid)]
    pending_by_channel = pending_suggestion_counts_by_channel(managed_ids)

    results = []
    total_online = 0
    for ch in channels:
        members, count = _presence_snapshot(ch.id)
        if count <= 0:
            continue
        total_online += count
        results.append(
            {
                "channel": ChannelSerializer(ch, context={"request": request}).data,
                "online_count": count,
                "members": members[:12],
                "pending_suggestions": pending_by_channel.get(ch.id, 0),
            }
        )
    results.sort(key=lambda r: -r["online_count"])
    return {"total_online": total_online, "results": results[:20]}


def build_pending_suggestions_payload(user: AbstractBaseUser) -> dict:
    channel_ids = manageable_channel_ids(user)
    counts = pending_suggestion_counts_by_channel(channel_ids)
    rows = [{"channel_id": cid, "pending_count": n} for cid, n in counts.items() if n > 0]
    return {"results": rows}
