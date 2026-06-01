"""Read-only dashboard aggregations."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser
from django.db.models import Count, Q, QuerySet

from apps.channels.models import Channel, ChannelMembership, ChannelPlaylistSuggestion


def active_member_channel_ids(user: AbstractBaseUser, *, limit: int = 40) -> list[int]:
    return list(
        Channel.objects.filter(
            Q(owner_id=user.id) | Q(memberships__user_id=user.id, memberships__is_active=True),
            is_active=True,
        )
        .distinct()
        .values_list("id", flat=True)[:limit]
    )


def manageable_channel_ids(user: AbstractBaseUser, *, limit: int = 60) -> list[int]:
    return list(
        Channel.objects.filter(
            Q(owner_id=user.id)
            | Q(
                memberships__user_id=user.id,
                memberships__is_active=True,
                memberships__role__in=[ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR],
            ),
            is_active=True,
        )
        .distinct()
        .values_list("id", flat=True)[:limit]
    )


def pending_suggestion_counts_by_channel(channel_ids: list[int]) -> dict[int, int]:
    if not channel_ids:
        return {}
    return {
        row["channel_id"]: row["n"]
        for row in ChannelPlaylistSuggestion.objects.filter(
            channel_id__in=channel_ids,
            status=ChannelPlaylistSuggestion.Status.PENDING,
        )
        .values("channel_id")
        .annotate(n=Count("id"))
    }


def channels_by_ids(channel_ids: list[int]) -> QuerySet[Channel]:
    return Channel.objects.filter(id__in=channel_ids).select_related("owner").order_by("-updated_at")
