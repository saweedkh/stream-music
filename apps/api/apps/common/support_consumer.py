"""WebSocket consumers for support tickets."""

from __future__ import annotations

import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.common.support_service import (
    apply_send_message,
    can_access_ticket,
    fetch_ticket_messages,
    is_support_staff,
    mark_ticket_read,
    patch_ticket,
    ticket_to_dict,
)

STAFF_INBOX_GROUP = "support_staff_inbox"


class SupportTicketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.ticket_id = int(self.scope["url_route"]["kwargs"]["ticket_id"])
        except (TypeError, ValueError, KeyError):
            await self.close(code=4400)
            return

        user = self.scope.get("user")
        if not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        allowed = await sync_to_async(can_access_ticket)(self.ticket_id, user.id)
        if not allowed:
            await self.close(code=4403)
            return

        self._staff = await sync_to_async(is_support_staff)(user)
        self.group_name = f"support_ticket_{self.ticket_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        history = await sync_to_async(fetch_ticket_messages)(self.ticket_id, user, limit=80)
        ticket_row = await sync_to_async(_get_ticket_row)(self.ticket_id, user)
        await sync_to_async(mark_ticket_read)(self.ticket_id, user.id)
        await self.send(
            text_data=json.dumps(
                {
                    "type": "SUPPORT_SYNC",
                    "ticket_id": self.ticket_id,
                    "ticket": ticket_row,
                    "messages": history,
                }
            )
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        user = self.scope.get("user")
        if not getattr(user, "is_authenticated", False):
            await self.send(text_data=json.dumps({"type": "SUPPORT_ERROR", "code": "auth"}))
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"type": "SUPPORT_ERROR", "code": "invalid_json"}))
            return
        if not isinstance(data, dict):
            await self.send(text_data=json.dumps({"type": "SUPPORT_ERROR", "code": "invalid_payload"}))
            return

        action = str(data.get("action") or "").strip().lower()

        if action == "send":
            body = data.get("body") if isinstance(data.get("body"), str) else ""
            is_internal = bool(data.get("is_internal"))
            msg, ticket, err = await sync_to_async(apply_send_message)(
                self.ticket_id, user, body, is_internal=is_internal
            )
            if err:
                await self.send(text_data=json.dumps({"type": "SUPPORT_ERROR", "code": err}))
                return
            await self._broadcast_message(msg, ticket)
            await self._notify_staff_inbox(ticket)
            return

        if action == "read":
            try:
                mid = int(data.get("message_id")) if data.get("message_id") is not None else None
            except (TypeError, ValueError):
                mid = None
            await sync_to_async(mark_ticket_read)(self.ticket_id, user.id, mid)
            return

        if action == "patch_ticket":
            if not self._staff:
                await self.send(text_data=json.dumps({"type": "SUPPORT_ERROR", "code": "forbidden"}))
                return
            patch_data = {k: data.get(k) for k in ("status", "priority", "assigned_to_id", "category") if k in data}
            ticket, err = await sync_to_async(patch_ticket)(self.ticket_id, user, patch_data)
            if err:
                await self.send(text_data=json.dumps({"type": "SUPPORT_ERROR", "code": err}))
                return
            ticket_dict = await sync_to_async(ticket_to_dict)(ticket, viewer=user, include_requester=True)
            await self._broadcast_ticket(ticket_dict)
            await self._notify_staff_inbox(ticket_dict)
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
            rows = await sync_to_async(fetch_ticket_messages)(self.ticket_id, user, limit=lim, before_id=before_id)
            await self.send(
                text_data=json.dumps(
                    {"type": "SUPPORT_HISTORY", "ticket_id": self.ticket_id, "messages": rows},
                )
            )
            return

        await self.send(text_data=json.dumps({"type": "SUPPORT_ERROR", "code": "unknown_action"}))

    async def _broadcast_message(self, message: dict, ticket: dict):
        payload = {
            "type": "SUPPORT_EVENT",
            "event": "message",
            "ticket_id": self.ticket_id,
            "message": message,
            "ticket": ticket,
        }
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "support_fanout", "payload": payload, "internal_only": bool(message.get("is_internal"))},
        )

    async def _broadcast_ticket(self, ticket: dict):
        payload = {
            "type": "SUPPORT_EVENT",
            "event": "ticket",
            "ticket_id": self.ticket_id,
            "ticket": ticket,
        }
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "support_fanout", "payload": payload, "internal_only": False},
        )

    async def _notify_staff_inbox(self, ticket: dict):
        await self.channel_layer.group_send(
            STAFF_INBOX_GROUP,
            {
                "type": "inbox_fanout",
                "payload": {"type": "SUPPORT_INBOX", "ticket": ticket},
            },
        )

    async def support_fanout(self, event):
        if event.get("internal_only") and not self._staff:
            return
        await self.send(text_data=json.dumps(event["payload"]))


class SupportStaffInboxConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return
        staff = await sync_to_async(is_support_staff)(user)
        if not staff:
            await self.close(code=4403)
            return
        await self.channel_layer.group_add(STAFF_INBOX_GROUP, self.channel_name)
        await self.accept()
        from apps.common.support_service import staff_inbox_stats

        stats = await sync_to_async(staff_inbox_stats)()
        await self.send(text_data=json.dumps({"type": "SUPPORT_INBOX_SYNC", "stats": stats}))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(STAFF_INBOX_GROUP, self.channel_name)

    async def inbox_fanout(self, event):
        await self.send(text_data=json.dumps(event["payload"]))


def _get_ticket_row(ticket_id: int, user):
    from apps.common.support_models import SupportTicket

    ticket = SupportTicket.objects.select_related("requester", "assigned_to").filter(id=ticket_id).first()
    if ticket is None:
        return None
    return ticket_to_dict(ticket, viewer=user, include_requester=is_support_staff(user))
