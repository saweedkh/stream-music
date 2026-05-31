"""Build follower activity feed."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Q

from apps.social.models import ActivityEvent, ChannelFollow, UserFollow


def build_activity_feed(user: User, *, limit: int = 50) -> dict:
    following_ids = list(UserFollow.objects.filter(follower_id=user.id).values_list("following_id", flat=True))
    channel_ids = list(ChannelFollow.objects.filter(user_id=user.id).values_list("channel_id", flat=True))
    clause = Q()
    if following_ids:
        clause |= Q(actor_id__in=following_ids)
    if channel_ids:
        clause |= Q(channel_id__in=channel_ids)
    if not clause:
        return {"results": []}
    rows = list(
        ActivityEvent.objects.filter(clause).select_related("actor", "channel").order_by("-created_at")[:limit]
    )
    return {
        "results": [
            {
                "id": r.id,
                "kind": r.kind,
                "actor_username": getattr(r.actor, "username", ""),
                "channel_id": r.channel_id,
                "channel_name": r.channel.name if r.channel else None,
                "metadata": r.metadata,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
    }


def record_activity(actor_id: int, kind: str, *, channel_id: int | None = None, metadata: dict | None = None) -> None:
    ActivityEvent.objects.create(
        actor_id=actor_id,
        kind=kind,
        channel_id=channel_id,
        metadata=metadata or {},
    )
