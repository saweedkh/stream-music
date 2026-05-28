"""Read-only channel queries (no side effects)."""

from __future__ import annotations

from django.db.models import QuerySet

from apps.channels.models import Channel, ChannelMembership


def active_channels_for_user(user_id: int) -> QuerySet[Channel]:
    return (
        Channel.objects.filter(is_active=True, memberships__user_id=user_id, memberships__is_active=True)
        .select_related("owner")
        .distinct()
    )


def channel_membership(user_id: int, channel_id: int) -> ChannelMembership | None:
    return (
        ChannelMembership.objects.filter(channel_id=channel_id, user_id=user_id, is_active=True)
        .select_related("user", "channel")
        .first()
    )
