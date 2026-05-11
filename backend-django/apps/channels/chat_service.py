"""Channel chat persistence + JSON shapes (used from WebSocket consumer)."""

from __future__ import annotations

from django.utils import timezone

from apps.channels.models import Channel, ChannelChatMessage, ChannelChatMessageReaction, ChannelMembership


def message_to_dict(msg: ChannelChatMessage) -> dict:
    reactions = []
    for r in msg.reactions.all().select_related("user"):
        reactions.append({"user_id": r.user_id, "username": r.user.username, "emoji": r.emoji})
    deleted = msg.deleted_at is not None
    return {
        "id": msg.id,
        "channel": msg.channel_id,
        "user_id": msg.user_id,
        "username": msg.user.username if msg.user_id else "?",
        "body": "" if deleted else (msg.body or ""),
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "deleted_at": msg.deleted_at.isoformat() if msg.deleted_at else None,
        "reactions": reactions,
    }


def fetch_chat_history(channel_id: int, *, limit: int = 80, before_id: int | None = None) -> list[dict]:
    lim = max(1, min(100, limit))
    qs = (
        ChannelChatMessage.objects.filter(channel_id=channel_id)
        .select_related("user")
        .prefetch_related("reactions__user")
        .order_by("-id")
    )
    if before_id is not None:
        qs = qs.filter(id__lt=before_id)
    rows = list(qs[:lim])
    rows.reverse()
    return [message_to_dict(m) for m in rows]


def can_access_chat(channel_id: int, user_id: int) -> bool:
    ch = Channel.objects.filter(id=channel_id).only("id", "is_active", "owner_id").first()
    if ch is None:
        return False
    if ChannelMembership.objects.filter(channel_id=channel_id, user_id=user_id, is_active=True).exists():
        return True
    if not ch.is_active and ch.owner_id == user_id:
        return True
    return False


def is_channel_staff(channel_id: int, user_id: int) -> bool:
    row = ChannelMembership.objects.filter(channel_id=channel_id, user_id=user_id, is_active=True).only("role").first()
    if row is None:
        return False
    return row.role in (ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR)


def apply_chat_send(channel_id: int, user, body: str) -> tuple[dict | None, str | None]:
    raw = (body or "").strip()
    if not raw or len(raw) > 2000:
        return None, "invalid_body"
    ch = Channel.objects.filter(id=channel_id).only("id", "is_active").first()
    if ch is None or not ch.is_active:
        return None, "channel_closed"
    msg = ChannelChatMessage.objects.create(channel_id=channel_id, user=user, body=raw)
    msg = ChannelChatMessage.objects.filter(id=msg.id).select_related("user").prefetch_related("reactions__user").first()
    return message_to_dict(msg), None


def apply_chat_edit(channel_id: int, user, message_id: int, body: str) -> tuple[dict | None, str | None]:
    raw = (body or "").strip()
    if not raw or len(raw) > 2000:
        return None, "invalid_body"
    msg = (
        ChannelChatMessage.objects.filter(id=message_id, channel_id=channel_id)
        .select_related("user")
        .prefetch_related("reactions__user")
        .first()
    )
    if msg is None or msg.deleted_at:
        return None, "not_found"
    if msg.user_id != user.id:
        return None, "forbidden"
    msg.body = raw
    msg.edited_at = timezone.now()
    msg.save(update_fields=["body", "edited_at"])
    return message_to_dict(msg), None


def apply_chat_delete(channel_id: int, user, message_id: int) -> tuple[dict | None, str | None]:
    msg = (
        ChannelChatMessage.objects.filter(id=message_id, channel_id=channel_id)
        .select_related("user")
        .prefetch_related("reactions__user")
        .first()
    )
    if msg is None or msg.deleted_at:
        return None, "not_found"
    staff = is_channel_staff(channel_id, user.id)
    if msg.user_id != user.id and not staff:
        return None, "forbidden"
    msg.deleted_at = timezone.now()
    msg.body = ""
    msg.save(update_fields=["deleted_at", "body"])
    ChannelChatMessageReaction.objects.filter(message_id=msg.id).delete()
    msg = ChannelChatMessage.objects.filter(id=msg.id).select_related("user").prefetch_related("reactions__user").first()
    return message_to_dict(msg), None


def apply_chat_react(channel_id: int, user, message_id: int, emoji: str | None) -> tuple[dict | None, str | None]:
    msg = (
        ChannelChatMessage.objects.filter(id=message_id, channel_id=channel_id)
        .select_related("user")
        .prefetch_related("reactions__user")
        .first()
    )
    if msg is None or msg.deleted_at:
        return None, "not_found"
    em = (emoji or "").strip()
    if not em:
        ChannelChatMessageReaction.objects.filter(message_id=message_id, user_id=user.id).delete()
    else:
        em = em[:16]
        if any(c.isspace() for c in em):
            return None, "invalid_emoji"
        ChannelChatMessageReaction.objects.update_or_create(
            message_id=message_id,
            user_id=user.id,
            defaults={"emoji": em},
        )
    msg = ChannelChatMessage.objects.filter(id=message_id).select_related("user").prefetch_related("reactions__user").first()
    return message_to_dict(msg), None


def apply_chat_purge_all(channel_id: int, user_id: int) -> str | None:
    """Hard-delete all messages in channel. Owner/moderator only."""
    if not is_channel_staff(channel_id, user_id):
        return "forbidden"
    ChannelChatMessage.objects.filter(channel_id=channel_id).delete()
    return None
