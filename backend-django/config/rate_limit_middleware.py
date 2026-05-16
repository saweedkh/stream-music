"""Simple in-memory rate limiting for auth and upload endpoints."""

from __future__ import annotations

import time
from collections import defaultdict

_BUCKETS: dict[str, list[float]] = defaultdict(list)

_LIMITS: dict[str, tuple[int, int]] = {
    "/api/auth/login": (20, 60),
    "/api/auth/register": (10, 60),
    "/api/tracks/upload/init": (30, 60),
}


def _client_key(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _allow(key: str, path: str) -> bool:
    rule = _LIMITS.get(path)
    if not rule:
        return True
    max_hits, window_sec = rule
    now = time.time()
    bucket_key = f"{key}:{path}"
    hits = [t for t in _BUCKETS[bucket_key] if now - t < window_sec]
    if len(hits) >= max_hits:
        _BUCKETS[bucket_key] = hits
        return False
    hits.append(now)
    _BUCKETS[bucket_key] = hits
    return True


class SimpleRateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path in _LIMITS and request.method == "POST":
            if not _allow(_client_key(request), path):
                from django.http import JsonResponse

                return JsonResponse({"detail": "rate_limited"}, status=429)
        return self.get_response(request)
