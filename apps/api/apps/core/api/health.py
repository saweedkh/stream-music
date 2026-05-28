"""Health and readiness probes."""

from __future__ import annotations

import time

from django.conf import settings
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = False
        redis_ok = False
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
            db_ok = True
        except Exception:
            db_ok = False
        try:
            import redis

            url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
            client = redis.from_url(url, socket_connect_timeout=1)
            client.ping()
            redis_ok = True
        except Exception:
            redis_ok = False
        ok = db_ok and redis_ok
        return Response(
            {
                "status": "ok" if ok else "degraded",
                "db": db_ok,
                "redis": redis_ok,
                "server_time": time.time(),
            },
            status=200 if ok else 503,
        )
