"""WebSocket broadcasts for suggestions and related room events."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from django.db.models import Count

from apps.channels.models import ChannelPlaylistSuggestion


def _collab_snapshot(channel_id: int) -> dict:
    pending_qs = ChannelPlaylistSuggestion.objects.filter(
        channel_id=channel_id,
        status=ChannelPlaylistSuggestion.Status.PENDING,
    ).select_related("user")
    pending = pending_qs.count()
    collab_users = (
        pending_qs.exclude(user_id__isnull=True)
        .values("user_id")
        .annotate(c=Count("id"))
        .order_by("-c")[:8]
    )
    usernames = []
    for row in collab_users:
        sug = pending_qs.filter(user_id=row["user_id"]).select_related("user").first()
        if sug and sug.user:
            usernames.append(getattr(sug.user, "username", "") or "?")
    recent_rows = pending_qs.select_related("user", "track").order_by("-created_at")[:5]
    return {
        "pending_count": pending,
        "collab_active_count": len(collab_users),
        "collab_usernames": usernames,
        "recent_pending": [
            {
                "id": s.id,
                "title": (s.track.title if s.track_id else None) or s.external_title or "—",
                "artist": s.external_artist or (s.track.artist if s.track_id else "") or "",
                "username": getattr(s.user, "username", "") or "?",
            }
            for s in recent_rows
        ],
    }


def broadcast_suggestions_updated(
    channel_id: int,
    *,
    event: str = "updated",
    actor_username: str | None = None,
) -> int:
    snap = _collab_snapshot(channel_id)
    pending = snap["pending_count"]
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        payload: dict = {
            "type": "SUGGESTIONS_UPDATED",
            "action": "suggestions_updated",
            "channel_id": channel_id,
            "pending_count": pending,
            "collab_active_count": snap["collab_active_count"],
            "collab_usernames": snap["collab_usernames"],
            "recent_pending": snap["recent_pending"],
            "event": event,
        }
        if actor_username:
            payload["actor_username"] = actor_username
        async_to_sync(channel_layer.group_send)(
            f"channel_{channel_id}",
            {"type": "broadcast_event", "payload": payload},
        )
    return pending
