"""Web Push (VAPID) delivery — optional when keys and pywebpush are configured."""

from __future__ import annotations

import json
import logging
import re
from urllib.parse import urlparse

from django.conf import settings

logger = logging.getLogger(__name__)


def channel_tab_url(
    channel_id: int,
    *,
    tab: str = "chat",
    message_id: int | None = None,
) -> str:
    base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    url = f"{base}/channel/{channel_id}?tab={tab}"
    if message_id is not None:
        url += f"&message={int(message_id)}"
    return url


def _vapid_config() -> tuple[str | None, str | None, str]:
    pub = getattr(settings, "WEBPUSH_VAPID_PUBLIC_KEY", "") or None
    priv = getattr(settings, "WEBPUSH_VAPID_PRIVATE_KEY", "") or None
    sub = getattr(settings, "WEBPUSH_VAPID_SUBJECT", "mailto:admin@localhost")
    return pub, priv, sub


def _subscription_dict(row) -> dict:
    return {"endpoint": row.endpoint, "keys": {"p256dh": row.p256dh, "auth": row.auth}}


def _vapid_claims_for_endpoint(endpoint: str, subject: str) -> dict:
    """Push services require `aud` = origin of the subscription endpoint (FCM/Mozilla/Apple)."""
    parsed = urlparse(endpoint or "")
    if parsed.scheme and parsed.netloc:
        aud = f"{parsed.scheme}://{parsed.netloc}"
    else:
        aud = "https://localhost"
    return {"sub": subject, "aud": aud}


def _in_quiet_hours(prefs) -> bool:
    start = getattr(prefs, "push_quiet_hours_start", None)
    end = getattr(prefs, "push_quiet_hours_end", None)
    if start is None or end is None:
        return False
    from datetime import datetime

    hour = datetime.now().hour
    start, end = int(start), int(end)
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end


def send_web_push_to_user(
    user_id: int,
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
    category: str = "chat",
) -> None:
    pub, priv, sub = _vapid_config()
    if not pub or not priv:
        return
    from apps.channels.models import UserNotificationSettings

    prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=user_id)
    if _in_quiet_hours(prefs):
        return
    cat = (category or "chat").lower()
    if cat == "chat" and not prefs.push_category_chat:
        return
    if cat == "playback" and not prefs.push_category_playback:
        return
    if cat in ("moderation", "reaction", "vote") and not prefs.push_category_moderation:
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        msg = "pywebpush not installed; web push disabled"
        if getattr(settings, "DEBUG", False):
            logger.warning(msg)
        else:
            logger.error(msg)
        return

    from apps.channels.models import WebPushSubscription

    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
            "category": cat,
        }
    )

    qs = WebPushSubscription.objects.filter(user_id=user_id).order_by("-id")[:8]
    if not qs:
        logger.info("webpush: no subscriptions for user_id=%s", user_id)
        return
    for row in qs:
        info = _subscription_dict(row)
        claims = _vapid_claims_for_endpoint(row.endpoint, sub)
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=priv,
                vapid_claims=claims,
                timeout=10,
            )
        except WebPushException as e:
            status = getattr(e, "response", None)
            code = getattr(status, "status_code", None) if status is not None else None
            if code in (404, 410):
                WebPushSubscription.objects.filter(pk=row.pk).delete()
            else:
                logger.warning("webpush failed user=%s code=%s endpoint=%s: %s", user_id, code, row.endpoint[:48], e)


def notify_channel_new_suggestion_push(channel_id: int, submitter_username: str, actor_user_id: int) -> None:
    """Notify channel owner + moderators when a listener submits a track suggestion."""
    from apps.channels.models import Channel, ChannelMembership, ChannelNotificationPreference, UserNotificationSettings
    from apps.playback.services.state_store import playback_state_store

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

    url = channel_tab_url(channel_id, tab="suggestions")
    tag = f"stream-{channel_id}-suggestion"
    title = f"[#{channel_id}] {channel.name}"
    body = f"New suggestion from @{submitter_username}"
    present = set(playback_state_store.presence_user_ids(channel_id))

    for uid in staff_ids:
        if uid == actor_user_id:
            continue
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=uid)
        ch_pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=uid)
        if ch_pref.muted or uid in present:
            continue
        if not prefs.push_category_moderation:
            continue
        send_web_push_to_user(uid, title=title[:60], body=body[:180], url=url, tag=tag, category="moderation")


def notify_channel_join_request_push(channel_id: int, applicant_username: str, actor_user_id: int) -> None:
    from apps.channels.models import Channel, ChannelMembership, ChannelNotificationPreference, UserNotificationSettings
    from apps.playback.services.state_store import playback_state_store

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
    url = channel_tab_url(channel_id, tab="people")
    title = f"[#{channel_id}] {channel.name}"
    body = f"Join request from @{applicant_username}"
    present = set(playback_state_store.presence_user_ids(channel_id))
    for uid in staff_ids:
        if uid == actor_user_id:
            continue
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=uid)
        ch_pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=uid)
        if ch_pref.muted or uid in present:
            continue
        if not prefs.push_category_moderation:
            continue
        send_web_push_to_user(
            uid,
            title=title[:60],
            body=body[:180],
            url=url,
            tag=f"stream-{channel_id}-join-request",
            category="moderation",
        )


def notify_channel_staff_social_push(channel_id: int, action: str, payload: dict, actor_user_id: int) -> None:
    """Notify channel owner + moderators about reactions / skip votes (if they opted in)."""
    from apps.channels.models import Channel, ChannelMembership, ChannelNotificationPreference, UserNotificationSettings
    from apps.playback.services.state_store import playback_state_store

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
    present = set(playback_state_store.presence_user_ids(channel_id))

    if action == "reaction":
        emoji = str(payload.get("emoji") or "♪")
        who = str(payload.get("username") or "?")
        title = f"[#{channel_id}] {channel.name}"
        body = f"Reaction {emoji} — {who}"
        for uid in staff_ids:
            if uid == actor_user_id:
                continue
            prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=uid)
            ch_pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=uid)
            if ch_pref.muted or uid in present:
                continue
            if not prefs.admin_notify_reactions:
                continue
            send_web_push_to_user(uid, title=title[:60], body=body[:180], url=url, tag=tag, category="moderation")
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
            ch_pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=uid)
            if ch_pref.muted or uid in present:
                continue
            if not prefs.admin_notify_votes:
                continue
            send_web_push_to_user(uid, title=title[:60], body=str(body)[:180], url=url, tag=tag, category="moderation")


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
    return any(m.group(1).lower() == ru for m in _MENTION_RE.finditer(body))


def notify_channel_track_changed_push(
    channel_id: int,
    *,
    track_title: str,
    actor_user_id: int | None = None,
    action: str = "next",
) -> None:
    """Notify members when the now-playing track changes (next, playlist, auto_next, etc.)."""
    from apps.channels.models import Channel, ChannelMembership, ChannelNotificationPreference, UserNotificationSettings
    from apps.playback.services.state_store import playback_state_store

    act = (action or "").lower()
    if act not in {"next", "prev", "play", "play_playlist", "shuffle_play", "auto_next"}:
        return

    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return

    label = (track_title or "").strip() or "New track"
    present = set(playback_state_store.presence_user_ids(channel_id))
    rows = ChannelMembership.objects.filter(channel_id=channel_id, is_active=True).exclude(user_id=actor_user_id)
    url = channel_tab_url(channel_id, tab="player")
    tag = f"stream-track-{channel_id}-{label[:32]}"
    title = f"[#{channel_id}] {channel.name}"
    body = f"Now playing: {label}"[:180]

    for row in rows:
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=row.user_id)
        if not prefs.push_category_playback:
            continue
        ch_pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=row.user_id)
        if ch_pref.muted or not ch_pref.notify_queue_turn:
            continue
        if row.user_id in present:
            continue
        send_web_push_to_user(row.user_id, title=title[:60], body=body, url=url, tag=tag, category="playback")


def notify_channel_chat_message_push(
    channel_id: int,
    *,
    author_id: int,
    author_username: str,
    body: str,
    message_id: int | None = None,
) -> None:
    from apps.channels.models import Channel, ChannelMembership, ChannelNotificationPreference, UserNotificationSettings
    from apps.playback.services.state_store import playback_state_store

    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return

    member_rows = list(
        ChannelMembership.objects.filter(channel_id=channel_id, is_active=True)
        .select_related("user")
        .exclude(user_id=author_id)
    )
    if not member_rows:
        return

    url = channel_tab_url(channel_id, tab="chat", message_id=message_id)
    tag = f"stream-chat-{channel_id}-{message_id or 'msg'}"
    title = f"[#{channel_id}] {channel.name}"
    preview = body.strip().replace("\n", " ")
    if len(preview) > 140:
        preview = preview[:137] + "…"
    text_body = f"{author_username}: {preview}"

    for m in member_rows:
        user = m.user
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=user.id)
        ch_pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=user.id)
        if ch_pref.muted:
            continue
        if not _user_wants_chat_push(prefs, body, user.username):
            continue
        if user.id in set(playback_state_store.presence_user_ids(channel_id)):
            continue
        send_web_push_to_user(user.id, title=title[:60], body=text_body[:180], url=url, tag=tag, category="chat")


def notify_channel_room_started_push(channel_id: int, actor_user_id: int | None = None) -> None:
    from apps.channels.models import Channel, ChannelMembership, ChannelNotificationPreference
    from apps.playback.services.state_store import playback_state_store
    from apps.social.models import ChannelFollow

    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return
    present = set(playback_state_store.presence_user_ids(channel_id))
    member_ids = set(
        ChannelMembership.objects.filter(channel_id=channel_id, is_active=True)
        .exclude(user_id=actor_user_id)
        .values_list("user_id", flat=True)
    )
    follower_ids = set(
        ChannelFollow.objects.filter(channel_id=channel_id, notify_live=True)
        .exclude(user_id=actor_user_id)
        .values_list("user_id", flat=True)
    )
    notify_ids = member_ids | follower_ids
    for user_id in notify_ids:
        if user_id in present:
            continue
        if user_id in member_ids:
            pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=user_id)
            if pref.muted or not pref.notify_room_started:
                continue
        send_web_push_to_user(
            user_id,
            title=f"[#{channel_id}] {channel.name}"[:60],
            body="Room is now live.",
            url=channel_tab_url(channel_id),
            tag=f"stream-room-started-{channel_id}",
            category="playback",
        )


def notify_channel_skip_threshold_near_push(
    channel_id: int, votes: int, threshold: int, actor_user_id: int | None = None
) -> None:
    from apps.channels.models import Channel, ChannelMembership, ChannelNotificationPreference
    from apps.playback.services.state_store import playback_state_store

    if threshold <= 0 or votes < max(1, threshold - 1):
        return
    channel = Channel.objects.filter(id=channel_id).first()
    if channel is None:
        return
    present = set(playback_state_store.presence_user_ids(channel_id))
    rows = ChannelMembership.objects.filter(channel_id=channel_id, is_active=True).exclude(user_id=actor_user_id)
    for row in rows:
        pref, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=row.user_id)
        if pref.muted or not pref.notify_skip_threshold:
            continue
        if row.user_id in present:
            continue
        send_web_push_to_user(
            row.user_id,
            title=f"[#{channel_id}] {channel.name}"[:60],
            body=f"Skip votes are near threshold ({votes}/{threshold}).",
            url=channel_tab_url(channel_id),
            tag=f"stream-skip-near-{channel_id}",
            category="playback",
        )
