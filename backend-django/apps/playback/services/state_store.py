import json
import time
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

    @staticmethod
    def _auto_next_lock_key(channel_id: int) -> str:
        return f"channel:{channel_id}:auto_next_lock"

    @staticmethod
    def _presence_key(channel_id: int) -> str:
        return f"channel:{channel_id}:presence"

    @staticmethod
    def _shout_key(channel_id: int) -> str:
        return f"channel:{channel_id}:shout_cooldown"

    @staticmethod
    def _skip_votes_key(channel_id: int, track_id: int) -> str:
        return f"channel:{channel_id}:skip_votes:{track_id}"

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

    def try_auto_next_lock(self, channel_id: int, ttl_sec: int = 5) -> bool:
        """One winner across listeners when many clients fire end-of-track at once."""
        if self._client is None:
            return True
        try:
            return bool(self._client.set(self._auto_next_lock_key(channel_id), "1", nx=True, ex=ttl_sec))
        except Exception:
            return True

    def clear_channel(self, channel_id: int) -> None:
        if self._client is None:
            return
        for key in (
            self._playback_key(channel_id),
            self._queue_key(channel_id),
            self._event_seq_key(channel_id),
            self._auto_next_lock_key(channel_id),
        ):
            try:
                self._client.delete(key)
            except Exception:
                pass

    def touch_presence(self, channel_id: int, user_id: int) -> None:
        if self._client is None:
            return
        try:
            now = time.time()
            self._client.zadd(self._presence_key(channel_id), {str(user_id): now})
            self._client.expire(self._presence_key(channel_id), 120)
        except Exception:
            return

    def clear_presence(self, channel_id: int, user_id: int) -> None:
        if self._client is None:
            return
        try:
            self._client.zrem(self._presence_key(channel_id), str(user_id))
        except Exception:
            return

    def presence_user_ids(self, channel_id: int, max_age_sec: int = 45, limit: int = 32) -> list[int]:
        if self._client is None:
            return []
        try:
            now = time.time()
            key = self._presence_key(channel_id)
            self._client.zremrangebyscore(key, 0, now - max_age_sec)
            raw = self._client.zrevrangebyscore(key, "+inf", "-inf", start=0, num=limit)
            out: list[int] = []
            for v in raw:
                try:
                    out.append(int(v))
                except Exception:
                    continue
            return out
        except Exception:
            return []

    def shout_cooldown_ok(self, channel_id: int, user_id: int, cooldown_sec: int = 30) -> bool:
        if self._client is None:
            return True
        try:
            return bool(self._client.set(f"{self._shout_key(channel_id)}:{user_id}", "1", nx=True, ex=cooldown_sec))
        except Exception:
            return True

    def add_skip_vote(self, channel_id: int, track_id: int, user_id: int, ttl_sec: int = 1800) -> int:
        if self._client is None:
            return -1
        try:
            key = self._skip_votes_key(channel_id, track_id)
            self._client.sadd(key, str(user_id))
            self._client.expire(key, ttl_sec)
            return int(self._client.scard(key))
        except Exception:
            return -1

    def clear_skip_votes(self, channel_id: int, track_id: int) -> None:
        if self._client is None:
            return
        try:
            self._client.delete(self._skip_votes_key(channel_id, track_id))
        except Exception:
            return


playback_state_store = PlaybackStateStore()
