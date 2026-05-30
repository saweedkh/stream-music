"""Channel chat moderation helpers."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.channels.models import Channel, ChannelChatBan, ChannelMembership


def chat_word_filters(channel_id: int) -> list[str]:
    ch = Channel.objects.filter(id=channel_id).only("experience").first()
    if not ch or not isinstance(ch.experience, dict):
        return []
    raw = ch.experience.get("chat_word_filters")
    if not isinstance(raw, list):
        return []
    return [str(w).strip().lower() for w in raw if str(w).strip()][:50]


def body_violates_word_filter(body: str, filters: list[str]) -> bool:
    if not filters:
        return False
    low = (body or "").lower()
    return any(len(word) >= 2 and word in low for word in filters)


def is_user_chat_banned(channel_id: int, user_id: int) -> bool:
    now = timezone.now()
    return ChannelChatBan.objects.filter(channel_id=channel_id, user_id=user_id, banned_until__gt=now).exists()


def is_channel_staff(channel_id: int, user_id: int) -> bool:
    row = ChannelMembership.objects.filter(channel_id=channel_id, user_id=user_id, is_active=True).only("role").first()
    if row is None:
        return False
    return row.role in (ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR)


def ban_user(
    channel_id: int, user_id: int, *, banned_by_id: int | None, hours: int, reason: str = ""
) -> ChannelChatBan:
    hours = max(1, min(24 * 30, int(hours)))
    until = timezone.now() + timedelta(hours=hours)
    row, _ = ChannelChatBan.objects.update_or_create(
        channel_id=channel_id,
        user_id=user_id,
        defaults={
            "banned_by_id": banned_by_id,
            "reason": (reason or "")[:280],
            "banned_until": until,
        },
    )
    return row


def unban_user(channel_id: int, user_id: int) -> None:
    ChannelChatBan.objects.filter(channel_id=channel_id, user_id=user_id).delete()
