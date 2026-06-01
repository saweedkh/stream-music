"""Queue serialization and WebSocket queue broadcasts."""

from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from apps.playback.models import PlaybackSession
from apps.playback.services.queue_advance import find_current_queue_index
from apps.playback.services.state_store import playback_state_store
from apps.playlists.models import ChannelQueueItem, ChannelQueueUpvote
from apps.playlists.playlists.playlist_serializers import QueueItemSerializer


def queue_serialize_context(channel_id: int, user_id: int | None, item_ids: list[int]) -> dict:
    from django.db.models import Count

    if not item_ids:
        return {"upvote_counts": {}, "user_upvoted_ids": set(), "added_by_names": {}}
    rows = ChannelQueueUpvote.objects.filter(queue_item_id__in=item_ids).values("queue_item_id").annotate(c=Count("id"))
    upvote_counts = {r["queue_item_id"]: r["c"] for r in rows}
    user_upvoted_ids = set()
    if user_id:
        user_upvoted_ids = set(
            ChannelQueueUpvote.objects.filter(queue_item_id__in=item_ids, user_id=user_id).values_list(
                "queue_item_id", flat=True
            )
        )
    items = ChannelQueueItem.objects.filter(id__in=item_ids).select_related("added_by")
    added_by_names = {i.added_by_id: i.added_by.username for i in items if i.added_by_id}
    return {
        "upvote_counts": upvote_counts,
        "user_upvoted_ids": user_upvoted_ids,
        "added_by_names": added_by_names,
    }


def serialize_queue(channel_id: int, user_id: int | None = None):
    from apps.accounts.premium_limits import track_owner_is_premium

    queue = list(
        ChannelQueueItem.objects.filter(channel_id=channel_id)
        .select_related("track", "track__owner", "added_by")
        .order_by("position", "id")
    )
    ctx = queue_serialize_context(channel_id, user_id, [q.id for q in queue])
    premium_track_ids = {q.track_id for q in queue if q.track_id and track_owner_is_premium(q.track)}
    session = PlaybackSession.objects.filter(channel_id=channel_id).only("track_id").first()
    current_idx = find_current_queue_index(queue, session.track_id if session else None)
    tail = queue[current_idx + 1 :] if current_idx + 1 < len(queue) else []
    premium_boosted_ids: set[int] = set()
    if len(tail) >= 2:
        prem = [r for r in tail if r.track_id in premium_track_ids]
        reg = [r for r in tail if r.track_id not in premium_track_ids]
        if prem and reg and len(prem) < len(tail):
            for row in prem:
                premium_boosted_ids.add(row.id)
    ctx["premium_track_ids"] = premium_track_ids
    ctx["premium_boosted_ids"] = premium_boosted_ids
    return QueueItemSerializer(queue, many=True, context=ctx).data


def broadcast_queue_updated(channel_id: int, user_id: int | None = None) -> list:
    serialized = serialize_queue(channel_id, user_id)
    playback_state_store.save_queue_snapshot(channel_id, list(serialized))
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            f"channel_{channel_id}",
            {
                "type": "broadcast_event",
                "payload": {
                    "type": "QUEUE_UPDATED",
                    "action": "queue_updated",
                    "channel_id": channel_id,
                    "queue": serialized,
                },
            },
        )
    return serialized
