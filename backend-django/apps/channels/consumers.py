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
from apps.common.webpush_service import notify_channel_chat_message_push


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
            result, err = await sync_to_async(apply_chat_send)(self.channel_id, user, body)
            if err:
                await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": err}))
                return
            await self._broadcast("message", result)
            await sync_to_async(_maybe_push_chat)(
                self.channel_id,
                user.id,
                getattr(user, "username", "") or "?",
                result.get("body") or "",
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

        await self.send(text_data=json.dumps({"type": "CHAT_ERROR", "code": "unknown_action"}))

    async def _broadcast(self, event_kind: str, message: dict):
        payload = {"type": "CHAT_EVENT", "event": event_kind, "channel_id": self.channel_id, "message": message}
        await self.channel_layer.group_send(self.group_name, {"type": "chat_fanout", "payload": payload})

    async def chat_fanout(self, event):
        await self.send(text_data=json.dumps(event["payload"]))


def _maybe_push_chat(channel_id: int, author_id: int, author_username: str, body: str) -> None:
    if not (body or "").strip():
        return
    notify_channel_chat_message_push(channel_id, author_id=author_id, author_username=author_username, body=body)
