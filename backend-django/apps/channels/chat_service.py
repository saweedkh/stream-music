"""Channel chat persistence + JSON shapes (used from WebSocket consumer)."""

from __future__ import annotations

import re
import time

from django.utils import timezone

from apps.channels.models import Channel, ChannelChatMessage, ChannelChatMessageReaction, ChannelMembership
from apps.channels.moderation import (
    body_violates_word_filter,
    chat_word_filters,
    is_user_chat_banned,
)
from apps.common.user_badges import user_badge_flags

_CHAT_SEND_TS: dict[tuple[int, int], list[float]] = {}
_CHAT_SEND_WINDOW = 12
_CHAT_SEND_MAX = 8

_TRACK_LINK_RE = re.compile(r"\[\[track:(\d+)\]\]")


def _chat_slow_seconds(channel_id: int) -> int:
    ch = Channel.objects.filter(id=channel_id).only("experience").first()
    if not ch or not isinstance(ch.experience, dict):
        return 0
    try:
        return max(0, min(120, int(ch.experience.get("chat_slow_mode_seconds") or 0)))
    except (TypeError, ValueError):
        return 0


def _slow_mode_ok(channel_id: int, user_id: int, staff: bool) -> bool:
    if staff:
        return True
    slow = _chat_slow_seconds(channel_id)
    if slow <= 0:
        return True
    key = (channel_id, user_id, "slow")
    now = time.time()
    hits = [t for t in _CHAT_SEND_TS.get(key, []) if now - t < slow]
    if hits:
        _CHAT_SEND_TS[key] = hits
        return False
    hits.append(now)
    _CHAT_SEND_TS[key] = hits
    return True


def _track_previews_from_body(body: str) -> list[dict]:
    from apps.tracks.models import Track

    ids = [int(m.group(1)) for m in _TRACK_LINK_RE.finditer(body or "")]
    if not ids:
        return []
    rows = Track.objects.filter(id__in=ids[:5]).only("id", "title", "artist", "album")
    return [{"id": t.id, "title": t.title, "artist": t.artist or "", "album": t.album or ""} for t in rows]


def message_to_dict(msg: ChannelChatMessage) -> dict:
    reactions = []
    for r in msg.reactions.all().select_related("user"):
        reactions.append(
            {
                "user_id": r.user_id,
                "username": r.user.username,
                "emoji": r.emoji,
                **user_badge_flags(r.user),
            }
        )
    deleted = msg.deleted_at is not None
    author_flags = user_badge_flags(msg.user) if msg.user_id else {"is_staff": False, "is_superuser": False, "is_premium": False, "badges": []}
    reply_preview = None
    if getattr(msg, "reply_to_id", None) and getattr(msg, "reply_to", None):
        parent = msg.reply_to
        if parent and not parent.deleted_at:
            reply_preview = {
                "id": parent.id,
                "username": parent.user.username if parent.user_id else "?",
                "body": (parent.body or "")[:120],
            }
    body = "" if deleted else (msg.body or "")
    return {
        "id": msg.id,
        "channel": msg.channel_id,
        "user_id": msg.user_id,
        "username": msg.user.username if msg.user_id else "?",
        **author_flags,
        "body": body,
        "reply_to_id": getattr(msg, "reply_to_id", None),
        "reply_preview": reply_preview,
        "track_previews": _track_previews_from_body(body) if body else [],
        "is_pinned": bool(getattr(msg, "is_pinned", False)),
        "pinned_at": msg.pinned_at.isoformat() if getattr(msg, "pinned_at", None) else None,
        "pinned_by_username": msg.pinned_by.username if getattr(msg, "pinned_by_id", None) and getattr(msg, "pinned_by", None) else None,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "deleted_at": msg.deleted_at.isoformat() if msg.deleted_at else None,
        "reactions": reactions,
    }


def fetch_chat_history(channel_id: int, *, limit: int = 80, before_id: int | None = None) -> list[dict]:
    lim = max(1, min(100, limit))
    qs = (
        ChannelChatMessage.objects.filter(channel_id=channel_id)
        .select_related("user", "pinned_by", "reply_to", "reply_to__user")
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


def _chat_rate_ok(channel_id: int, user_id: int) -> bool:
    now = time.time()
    key = (channel_id, user_id)
    hits = [t for t in _CHAT_SEND_TS.get(key, []) if now - t < _CHAT_SEND_WINDOW]
    if len(hits) >= _CHAT_SEND_MAX:
        _CHAT_SEND_TS[key] = hits
        return False
    hits.append(now)
    _CHAT_SEND_TS[key] = hits
    return True


def apply_chat_send(
    channel_id: int,
    user,
    body: str,
    *,
    reply_to_id: int | None = None,
) -> tuple[dict | None, str | None]:
    raw = (body or "").strip()
    if not raw or len(raw) > 2000:
        return None, "invalid_body"
    staff = is_channel_staff(channel_id, user.id)
    if not staff and is_user_chat_banned(channel_id, user.id):
        return None, "banned"
    filters = chat_word_filters(channel_id)
    if not staff and body_violates_word_filter(raw, filters):
        return None, "word_filter"
    if not _chat_rate_ok(channel_id, user.id):
        return None, "rate_limited"
    if not _slow_mode_ok(channel_id, user.id, staff):
        return None, "slow_mode"
    ch = Channel.objects.filter(id=channel_id).only("id", "is_active").first()
    if ch is None or not ch.is_active:
        return None, "channel_closed"
    parent_id = None
    if reply_to_id is not None:
        parent = ChannelChatMessage.objects.filter(id=reply_to_id, channel_id=channel_id).only("id", "deleted_at").first()
        if parent is None or parent.deleted_at:
            return None, "invalid_reply"
        parent_id = parent.id
    msg = ChannelChatMessage.objects.create(
        channel_id=channel_id,
        user=user,
        body=raw,
        reply_to_id=parent_id,
    )
    msg = (
        ChannelChatMessage.objects.filter(id=msg.id)
        .select_related("user", "pinned_by", "reply_to", "reply_to__user")
        .prefetch_related("reactions__user")
        .first()
    )
    return message_to_dict(msg), None


def apply_chat_edit(channel_id: int, user, message_id: int, body: str) -> tuple[dict | None, str | None]:
    raw = (body or "").strip()
    if not raw or len(raw) > 2000:
        return None, "invalid_body"
    msg = (
        ChannelChatMessage.objects.filter(id=message_id, channel_id=channel_id)
        .select_related("user", "pinned_by", "reply_to", "reply_to__user")
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
        .select_related("user", "pinned_by", "reply_to", "reply_to__user")
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
    msg = (
        ChannelChatMessage.objects.filter(id=msg.id)
        .select_related("user", "pinned_by", "reply_to", "reply_to__user")
        .prefetch_related("reactions__user")
        .first()
    )
    return message_to_dict(msg), None


def apply_chat_react(channel_id: int, user, message_id: int, emoji: str | None) -> tuple[dict | None, str | None]:
    msg = (
        ChannelChatMessage.objects.filter(id=message_id, channel_id=channel_id)
        .select_related("user", "pinned_by", "reply_to", "reply_to__user")
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
    msg = (
        ChannelChatMessage.objects.filter(id=message_id)
        .select_related("user", "pinned_by", "reply_to", "reply_to__user")
        .prefetch_related("reactions__user")
        .first()
    )
    return message_to_dict(msg), None


def apply_chat_purge_all(channel_id: int, user_id: int) -> str | None:
    """Hard-delete all messages in channel. Owner/moderator only."""
    if not is_channel_staff(channel_id, user_id):
        return "forbidden"
    ChannelChatMessage.objects.filter(channel_id=channel_id).delete()
    return None
