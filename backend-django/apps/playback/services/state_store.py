import json
from typing import Any

from django.conf import settings

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional runtime dependency guard
    Redis = None  # type: ignore[assignment]


class PlaybackStateStore:
    def __init__(self):
        self._client = None
        if Redis is None:
            return
        try:
            self._client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception:
            self._client = None

    @staticmethod
    def _playback_key(channel_id: int) -> str:
        return f"channel:{channel_id}:playback"

    @staticmethod
    def _queue_key(channel_id: int) -> str:
        return f"channel:{channel_id}:queue"

    @staticmethod
    def _event_seq_key(channel_id: int) -> str:
        return f"channel:{channel_id}:event_seq"

    def save_playback_snapshot(self, channel_id: int, payload: dict[str, Any]) -> None:
        if self._client is None:
            return
        try:
            self._client.set(self._playback_key(channel_id), json.dumps(payload), ex=3600)
        except Exception:
            # Redis is an optimization layer; never fail request flow on cache issues.
            return

    def get_playback_snapshot(self, channel_id: int) -> dict[str, Any] | None:
        if self._client is None:
            return None
        try:
            raw = self._client.get(self._playback_key(channel_id))
            if not raw:
                return None
            data = json.loads(raw)
            if isinstance(data, dict):
                return data
            return None
        except Exception:
            return None

    def save_queue_snapshot(self, channel_id: int, queue_rows: list[dict[str, Any]]) -> None:
        if self._client is None:
            return
        try:
            self._client.set(self._queue_key(channel_id), json.dumps(queue_rows), ex=3600)
        except Exception:
            return

    def get_queue_snapshot(self, channel_id: int) -> list[dict[str, Any]] | None:
        if self._client is None:
            return None
        try:
            raw = self._client.get(self._queue_key(channel_id))
            if not raw:
                return None
            data = json.loads(raw)
            if isinstance(data, list):
                return data
            return None
        except Exception:
            return None

    def next_event_seq(self, channel_id: int) -> int:
        if self._client is None:
            # Fallback sequence when Redis is unavailable.
            from time import time

            return int(time() * 1000)
        try:
            return int(self._client.incr(self._event_seq_key(channel_id)))
        except Exception:
            from time import time

            return int(time() * 1000)


playback_state_store = PlaybackStateStore()
