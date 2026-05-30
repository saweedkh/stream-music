"""Redis-backed rate limiting for auth and upload endpoints.

Falls back to in-memory buckets when Redis is unavailable so the app
never crashes due to a rate-limiter failure.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict

logger = logging.getLogger(__name__)

_LIMITS: dict[str, tuple[int, int]] = {
    "/api/auth/login": (20, 60),
    "/api/auth/register": (10, 60),
    "/api/tracks/upload/init": (30, 60),
}

_redis_client = None
_redis_failed = False

_MEMORY_BUCKETS: dict[str, list[float]] = defaultdict(list)


def _get_redis():
    global _redis_client, _redis_failed
    if _redis_failed:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        from django.conf import settings

        _redis_client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        _redis_client.ping()
        return _redis_client
    except Exception:
        logger.warning("Rate limiter: Redis unavailable, falling back to in-memory.")
        _redis_failed = True
        return None


def _client_key(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _allow_redis(r, bucket_key: str, max_hits: int, window_sec: int) -> bool:
    try:
        pipe = r.pipeline()
        now = time.time()
        pipe.zremrangebyscore(bucket_key, 0, now - window_sec)
        pipe.zadd(bucket_key, {str(now): now})
        pipe.zcard(bucket_key)
        pipe.expire(bucket_key, window_sec + 1)
        results = pipe.execute()
        return results[2] <= max_hits
    except Exception:
        return True


def _allow_memory(bucket_key: str, max_hits: int, window_sec: int) -> bool:
    now = time.time()
    hits = [t for t in _MEMORY_BUCKETS[bucket_key] if now - t < window_sec]
    if len(hits) >= max_hits:
        _MEMORY_BUCKETS[bucket_key] = hits
        return False
    hits.append(now)
    _MEMORY_BUCKETS[bucket_key] = hits
    return True


def _allow(key: str, path: str) -> bool:
    rule = _LIMITS.get(path)
    if not rule:
        return True
    max_hits, window_sec = rule
    bucket_key = f"rl:{key}:{path}"

    r = _get_redis()
    if r:
        return _allow_redis(r, bucket_key, max_hits, window_sec)
    return _allow_memory(bucket_key, max_hits, window_sec)


def _rate_limit_disabled() -> bool:
    from django.conf import settings

    return bool(getattr(settings, "E2E_RATE_LIMIT_OFF", False))


class SimpleRateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if _rate_limit_disabled():
            return self.get_response(request)
        path = request.path
        if path in _LIMITS and request.method == "POST" and not _allow(_client_key(request), path):
            from django.http import JsonResponse

            return JsonResponse({"detail": "rate_limited"}, status=429)
        return self.get_response(request)
