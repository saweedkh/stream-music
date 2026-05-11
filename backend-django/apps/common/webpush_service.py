"""Web Push (VAPID) delivery — optional when keys and pywebpush are configured."""

from __future__ import annotations

import json
import logging
import re

from django.conf import settings

logger = logging.getLogger(__name__)


def channel_tab_url(channel_id: int) -> str:
    base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{base}/channel/{channel_id}?tab=chat"


def _vapid_config() -> tuple[str | None, str | None, str]:
    pub = getattr(settings, "WEBPUSH_VAPID_PUBLIC_KEY", "") or None
    priv = getattr(settings, "WEBPUSH_VAPID_PRIVATE_KEY", "") or None
    sub = getattr(settings, "WEBPUSH_VAPID_SUBJECT", "mailto:admin@localhost")
    return pub, priv, sub


def _subscription_dict(row) -> dict:
    return {"endpoint": row.endpoint, "keys": {"p256dh": row.p256dh, "auth": row.auth}}


def send_web_push_to_user(user_id: int, *, title: str, body: str, url: str, tag: str) -> None:
    pub, priv, sub = _vapid_config()
    if not pub or not priv:
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush not installed; skipping web push")
        return

    from apps.channels.models import WebPushSubscription

    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
        }
    )

    qs = WebPushSubscription.objects.filter(user_id=user_id).order_by("-id")[:8]
    for row in qs:
        info = _subscription_dict(row)
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=priv,
                vapid_claims={"sub": sub},
                timeout=10,
            )
        except WebPushException as e:
            status = getattr(e, "response", None)
            code = getattr(status, "status_code", None) if status is not None else None
            if code in (404, 410):
                WebPushSubscription.objects.filter(pk=row.pk).delete()
            else:
                logger.debug("webpush failed user=%s: %s", user_id, e)


def notify_channel_staff_social_push(channel_id: int, action: str, payload: dict, actor_user_id: int) -> None:
    """Notify channel owner + moderators about reactions / skip votes (if they opted in)."""
    from apps.channels.models import Channel, ChannelMembership, UserNotificationSettings

    action = (action or "").lower()
    if action not in {"reaction", "vote_skip"}:
        return

    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return

    staff_ids = list(
        ChannelMembership.objects.filter(
            channel_id=channel_id,
            is_active=True,
            role__in=[ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR],
        ).values_list("user_id", flat=True)
    )
    if not staff_ids:
        return

    url = channel_tab_url(channel_id)
    tag = f"stream-{channel_id}-{action}"

    if action == "reaction":
        emoji = str(payload.get("emoji") or "♪")
        who = str(payload.get("username") or "?")
        title = f"[#{channel_id}] {channel.name}"
        body = f"Reaction {emoji} — {who}"
        for uid in staff_ids:
            if uid == actor_user_id:
                continue
            prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=uid)
            if not prefs.admin_notify_reactions:
                continue
            send_web_push_to_user(uid, title=title[:60], body=body[:180], url=url, tag=tag)
        return

    if action == "vote_skip":
        votes = payload.get("votes")
        thr = payload.get("threshold")
        title = f"[#{channel_id}] {channel.name}"
        body = f"Skip votes: {votes}" + (f" / {thr}" if thr else "")
        for uid in staff_ids:
            if uid == actor_user_id:
                continue
            prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=uid)
            if not prefs.admin_notify_votes:
                continue
            send_web_push_to_user(uid, title=title[:60], body=str(body)[:180], url=url, tag=tag)


_MENTION_RE = re.compile(r"@([\w-]{1,64})", re.UNICODE)


def _user_wants_chat_push(prefs, body: str, recipient_username: str) -> bool:
    mode = prefs.chat_notify
    if mode == "muted":
        return False
    if mode == "all":
        return True
    low = body.lower()
    if "@everyone" in low or "@all" in low:
        return True
    ru = (recipient_username or "").lower()
    for m in _MENTION_RE.finditer(body):
        if m.group(1).lower() == ru:
            return True
    return False


def notify_channel_chat_message_push(channel_id: int, *, author_id: int, author_username: str, body: str) -> None:
    from apps.channels.models import Channel, ChannelMembership, UserNotificationSettings

    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return

    member_rows = list(
        ChannelMembership.objects.filter(channel_id=channel_id, is_active=True).select_related("user").exclude(user_id=author_id)
    )
    if not member_rows:
        return

    url = channel_tab_url(channel_id)
    tag = f"stream-chat-{channel_id}"
    title = f"[#{channel_id}] {channel.name}"
    preview = body.strip().replace("\n", " ")
    if len(preview) > 140:
        preview = preview[:137] + "…"
    text_body = f"{author_username}: {preview}"

    for m in member_rows:
        user = m.user
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=user.id)
        if not _user_wants_chat_push(prefs, body, user.username):
            continue
        send_web_push_to_user(user.id, title=title[:60], body=text_body[:180], url=url, tag=tag)
