"""WebSocket consumer for channel text chat (separate from playback socket)."""

from __future__ import annotations

import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.channels.chat_service import (
    apply_chat_delete,
    apply_chat_edit,
    apply_chat_purge_all,
    apply_chat_react,
    apply_chat_send,
    can_access_chat,
    fetch_chat_history,
)
from apps.channels.models import ChannelChatMessage, ChannelMembership
from apps.channels.serializers.channel_serializers import ChannelChatMessageSerializer
from apps.core.services.webpush import notify_channel_chat_message_push


class ChannelChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.channel_id = int(self.scope["url_route"]["kwargs"]["channel_id"])
        except (TypeError, ValueError, KeyError):
            await self.close(code=4400)
            return

        user = self.scope.get("user")
        if not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        allowed = await sync_to_async(can_access_chat)(self.channel_id, user.id)
        if not allowed:
            await self.close(code=4403)
            return

        self.group_name = f"chat_channel_{self.channel_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        history = await sync_to_async(fetch_chat_history)(self.channel_id, limit=80)
        await self.send(text_data=json.dumps({"type": "CHAT_SYNC", "channel_id": self.channel_id, "messages": history}))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        user = self.scope.get("user")
        if not getattr(user, "is_authenticated", False):
            await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "auth"}))
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "invalid_json"}))
            return
        if not isinstance(data, dict):
            await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "invalid_payload"}))
            return

        action = str(data.get("action") or "").strip().lower()
        if action == "send":
            body = data.get("body") if isinstance(data.get("body"), str) else ""
            reply_raw = data.get("reply_to_id")
            try:
                reply_to_id = int(reply_raw) if reply_raw not in (None, "") else None
            except (TypeError, ValueError):
                reply_to_id = None
            result, err = await sync_to_async(apply_chat_send)(
                self.channel_id,
                user,
                body,
                reply_to_id=reply_to_id,
            )
            if err:
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": err}))
                return
            await self._broadcast("message", result)
            await sync_to_async(_maybe_push_chat)(
                self.channel_id,
                user.id,
                getattr(user, "username", "") or "?",
                result.get("body") or "",
                int(result.get("id")) if result.get("id") is not None else None,
            )
            return

        if action == "edit":
            try:
                mid = int(data.get("message_id"))
            except (TypeError, ValueError):
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "invalid_message_id"}))
                return
            body = data.get("body") if isinstance(data.get("body"), str) else ""
            result, err = await sync_to_async(apply_chat_edit)(self.channel_id, user, mid, body)
            if err:
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": err}))
                return
            await self._broadcast("message", result)
            return

        if action == "delete":
            try:
                mid = int(data.get("message_id"))
            except (TypeError, ValueError):
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "invalid_message_id"}))
                return
            result, err = await sync_to_async(apply_chat_delete)(self.channel_id, user, mid)
            if err:
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": err}))
                return
            await self._broadcast("message", result)
            return

        if action == "react":
            try:
                mid = int(data.get("message_id"))
            except (TypeError, ValueError):
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "invalid_message_id"}))
                return
            emoji = data.get("emoji") if isinstance(data.get("emoji"), str) else ""
            result, err = await sync_to_async(apply_chat_react)(self.channel_id, user, mid, emoji)
            if err:
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": err}))
                return
            await self._broadcast("message", result)
            return

        if action == "history":
            try:
                before = data.get("before")
                before_id = int(before) if before is not None and str(before).strip() != "" else None
            except (TypeError, ValueError):
                before_id = None
            try:
                lim = int(data.get("limit", 40))
            except (TypeError, ValueError):
                lim = 40
            rows = await sync_to_async(fetch_chat_history)(self.channel_id, limit=lim, before_id=before_id)
            await self.send(
                text_data=json.dumps({"type": "CHAT_HISTORY", "channel_id": self.channel_id, "messages": rows}),
            )
            return

        if action == "purge_all":
            err = await sync_to_async(apply_chat_purge_all)(self.channel_id, user.id)
            if err:
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": err}))
                return
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "chat_fanout", "payload": {"type": "CHAT_PURGED", "channel_id": self.channel_id}},
            )
            return

        if action == "pin":
            try:
                mid_raw = data.get("message_id")
                mid = int(mid_raw) if mid_raw not in (None, "", 0) else None
            except (TypeError, ValueError):
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "invalid_message_id"}))
                return
            is_staff = await sync_to_async(
                lambda: ChannelMembership.objects.filter(
                    channel_id=self.channel_id,
                    user_id=user.id,
                    is_active=True,
                    role__in=[ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR],
                ).exists()
            )()
            if not is_staff:
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "forbidden"}))
                return

            @sync_to_async
            def _pin():
                ChannelChatMessage.objects.filter(channel_id=self.channel_id, is_pinned=True).update(
                    is_pinned=False, pinned_at=None, pinned_by=None
                )
                if mid is None:
                    return None
                m = ChannelChatMessage.objects.filter(channel_id=self.channel_id, id=mid).first()
                if not m:
                    return None
                from django.utils import timezone

                m.is_pinned = True
                m.pinned_at = timezone.now()
                m.pinned_by_id = user.id
                m.save(update_fields=["is_pinned", "pinned_at", "pinned_by"])
                return ChannelChatMessageSerializer(m, context={"request": None}).data

            msg = await _pin()
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_fanout",
                    "payload": {"type": "CHAT_PINNED", "channel_id": self.channel_id, "message": msg},
                },
            )
            return

        await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "unknown_action"}))

    async def _broadcast(self, event_kind: str, message: dict):
        payload = {"type": "CHAT_EVENT", "event": event_kind, "channel_id": self.channel_id, "message": message}
        await self.channel_layer.group_send(self.group_name, {"type": "chat_fanout", "payload": payload})

    async def chat_fanout(self, event):
        await self.send(text_data=json.dumps(event["payload"]))


def _maybe_push_chat(
    channel_id: int,
    author_id: int,
    author_username: str,
    body: str,
    message_id: int | None = None,
) -> None:
    if not (body or "").strip():
        return
    notify_channel_chat_message_push(
        channel_id,
        author_id=author_id,
        author_username=author_username,
        body=body,
        message_id=message_id,
    )
