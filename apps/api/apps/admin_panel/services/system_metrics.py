"""Extended system metrics for admin dashboard."""

from __future__ import annotations

import contextlib
import os
import shutil
import time

from django.conf import settings
from django.contrib.auth.models import User
from django.db import connection

from apps.channels.models import Channel
from apps.playback.consumers import _presence_snapshot
from apps.playback.models import PlaybackSession
from apps.tracks.models import Track


def _media_disk() -> dict:
    root = getattr(settings, "MEDIA_ROOT", "")
    try:
        usage = shutil.disk_usage(root)
        return {
            "path": str(root),
            "total_gb": round(usage.total / (1024**3), 2),
            "used_gb": round(usage.used / (1024**3), 2),
            "free_gb": round(usage.free / (1024**3), 2),
            "used_percent": round(100 * usage.used / usage.total, 1) if usage.total else 0,
        }
    except OSError:
        return {"path": str(root), "error": "unavailable"}


def _celery_status() -> dict:
    try:
        from config.celery import app

        insp = app.control.inspect(timeout=1.0)
        stats = insp.stats() if insp else None
        active = insp.active() if insp else None
        workers = len(stats) if stats else 0
        tasks_active = sum(len(v or []) for v in (active or {}).values())
        return {"workers": workers, "tasks_active": tasks_active, "reachable": workers > 0}
    except Exception as exc:
        return {"workers": 0, "tasks_active": 0, "reachable": False, "error": str(exc)[:200]}


def build_admin_system_payload() -> dict:
    db_ok = False
    redis_ok = False
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        db_ok = True
    except Exception:
        pass
    try:
        import redis

        client = redis.from_url(getattr(settings, "REDIS_URL", "redis://localhost:6379/0"), socket_connect_timeout=1)
        client.ping()
        redis_ok = True
    except Exception:
        pass

    presence_channels = 0
    presence_listeners = 0
    for ch_id in Channel.objects.filter(is_active=True).values_list("id", flat=True)[:200]:
        _, n = _presence_snapshot(int(ch_id))
        if n > 0:
            presence_channels += 1
            presence_listeners += n

    track_bytes = 0
    media_root = getattr(settings, "MEDIA_ROOT", "")
    audio_dir = os.path.join(media_root, "audio")
    if os.path.isdir(audio_dir):
        for _root, _dirs, files in os.walk(audio_dir):
            for fn in files:
                with contextlib.suppress(OSError):
                    track_bytes += os.path.getsize(os.path.join(_root, fn))

    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "db": db_ok,
        "redis": redis_ok,
        "server_time": time.time(),
        "channels_active": Channel.objects.filter(is_active=True).count(),
        "channels_playing": PlaybackSession.objects.filter(is_playing=True).count(),
        "tracks_total": Track.objects.count(),
        "users_active": User.objects.filter(is_active=True).count(),
        "media_audio_gb": round(track_bytes / (1024**3), 3),
        "disk": _media_disk(),
        "celery": _celery_status(),
        "realtime": {
            "channels_with_presence": presence_channels,
            "listeners_in_presence": presence_listeners,
        },
    }
