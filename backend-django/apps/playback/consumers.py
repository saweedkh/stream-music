import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.playback.permissions import can_control_channel


class ChannelPlaybackConsumer(AsyncWebsocketConsumer):
    @staticmethod
    def _normalize_action(action: str | None) -> str | None:
        if action is None:
            return None
        value = action.strip().lower()
        if value in {"play", "pause", "seek", "next", "prev"}:
            return value
        return None

    async def connect(self):
        self.channel_id = self.scope["url_route"]["kwargs"]["channel_id"]
        self.group_name = f"channel_{self.channel_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        raw_action = data.get("action")
        if raw_action == "PING_LATENCY":
            await self.send(text_data=json.dumps({"type": "PONG_LATENCY", "client_ts": data.get("client_ts")}))
            return
        action = self._normalize_action(raw_action)
        user = self.scope.get("user")
        if action is None:
            await self.send(text_data=json.dumps({"type": "ERROR", "message": "invalid_action"}))
            return

        has_permission = await sync_to_async(can_control_channel)(user, int(self.channel_id))
        if not has_permission:
            await self.send(text_data=json.dumps({"type": "ERROR", "message": "permission_denied"}))
            return

        await self.channel_layer.group_send(
            self.group_name,
            {"type": "broadcast_event", "payload": {"type": action.upper(), "action": action, **data}},
        )

    async def broadcast_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
