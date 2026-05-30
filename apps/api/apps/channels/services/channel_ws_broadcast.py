"""WebSocket broadcasts for suggestions and related room events."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from apps.channels.models import ChannelPlaylistSuggestion


def broadcast_suggestions_updated(
    channel_id: int,
    *,
    event: str = "updated",
    actor_username: str | None = None,
) -> int:
    pending = ChannelPlaylistSuggestion.objects.filter(
        channel_id=channel_id,
        status=ChannelPlaylistSuggestion.Status.PENDING,
    ).count()
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        payload: dict = {
            "type": "SUGGESTIONS_UPDATED",
            "action": "suggestions_updated",
            "channel_id": channel_id,
            "pending_count": pending,
            "event": event,
        }
        if actor_username:
            payload["actor_username"] = actor_username
        async_to_sync(channel_layer.group_send)(
            f"channel_{channel_id}",
            {"type": "broadcast_event", "payload": payload},
        )
    return pending
