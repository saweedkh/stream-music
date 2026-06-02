"""Async track import and maintenance tasks."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)

_IMPORT_FAIL_MESSAGES = {
    "download_failed": "Could not download audio (server may block YouTube/SoundCloud — set YTDLP_PROXY).",
    "download_timeout": "Download timed out.",
    "spotify_metadata_failed": "Could not read Spotify track info.",
    "rate_limited": "Too many imports this hour.",
    "ytdlp_not_installed": "yt-dlp is not available on the server.",
    "unsupported_host": "This link is not supported.",
    "not_a_track_url": "Use a direct track link (e.g. Spotify /track/…).",
}


def _notify_import_result(
    user_id: int,
    *,
    ok: bool,
    detail: str = "",
    track_title: str = "",
) -> None:
    from django.conf import settings

    from apps.core.tasks import send_webpush_notification

    base = getattr(settings, "FRONTEND_BASE_URL", "/").rstrip("/")
    dashboard = f"{base}/dashboard"
    try:
        if ok:
            send_webpush_notification.delay(
                user_id,
                "Track imported",
                track_title or "Added to your library",
                dashboard,
                tag="track-import-ok",
            )
        else:
            body = _IMPORT_FAIL_MESSAGES.get(detail, detail or "Import failed")
            send_webpush_notification.delay(
                user_id,
                "Import from link failed",
                body,
                dashboard,
                tag="track-import-fail",
            )
    except Exception:
        logger.debug("import push notification skipped", exc_info=True)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def import_streaming_track_task(
    self,
    user_id: int,
    url: str,
    *,
    title: str = "",
    visibility: str = "private",
    artist: str = "",
    album: str = "",
    genre: str = "",
    tags: list[str] | None = None,
) -> dict:
    from django.contrib.auth import get_user_model

    from apps.tracks.services.external_audio_import import ExternalImportError, import_streaming_track

    user = get_user_model().objects.filter(pk=user_id).first()
    if not user:
        return {"ok": False, "detail": "user_not_found"}
    try:
        payload, _code, duplicate = import_streaming_track(
            user=user,
            url=url,
            title=title,
            visibility=visibility,
            artist=artist,
            album=album,
            genre=genre,
            tags=tags,
        )
        track_title = payload.get("title") or title
        _notify_import_result(user_id, ok=True, track_title=track_title)
        return {"ok": True, "track_id": payload["id"], "duplicate": duplicate}
    except ExternalImportError as exc:
        _notify_import_result(user_id, ok=False, detail=exc.code)
        return {"ok": False, "detail": exc.code}
    except Exception as exc:
        logger.exception("import_streaming_track_task failed")
        raise self.retry(exc=exc) from exc


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def import_direct_url_track_task(
    self,
    user_id: int,
    url: str,
    *,
    title: str = "",
    visibility: str = "private",
    artist: str = "",
    album: str = "",
    genre: str = "",
    tags: list[str] | None = None,
) -> dict:
    from django.contrib.auth import get_user_model

    from apps.tracks.services.url_import import import_track_from_url

    user = get_user_model().objects.filter(pk=user_id).first()
    if not user:
        return {"ok": False, "detail": "user_not_found"}
    try:
        payload, _code, duplicate = import_track_from_url(
            user=user,
            url=url,
            title=title,
            visibility=visibility,
            artist=artist,
            album=album,
            genre=genre,
            tags=tags,
        )
        track_title = payload.get("title") or title
        _notify_import_result(user_id, ok=True, track_title=track_title)
        return {"ok": True, "track_id": payload["id"], "duplicate": duplicate}
    except ValueError as exc:
        code = str(exc) or "import_failed"
        _notify_import_result(user_id, ok=False, detail=code)
        return {"ok": False, "detail": code}
    except Exception as exc:
        logger.exception("import_direct_url_track_task failed")
        raise self.retry(exc=exc) from exc


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def import_external_track_task(self, user_id: int, url: str) -> dict:
    return import_streaming_track_task.apply(
        args=(user_id, url),
        throw=True,
    ).get()


@shared_task
def cleanup_unused_tracks_task() -> dict:
    from apps.tracks.services.retention import cleanup_unused_tracks

    return cleanup_unused_tracks()


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def transcode_track_low_task(self, track_id: int) -> dict:
    from apps.tracks.services.transcode import TranscodeError, transcode_track_low

    try:
        ok = transcode_track_low(track_id)
        return {"ok": ok, "track_id": track_id}
    except TranscodeError as exc:
        return {"ok": False, "track_id": track_id, "detail": str(exc)}
    except Exception as exc:
        logger.exception("transcode_track_low_task failed track_id=%s", track_id)
        raise self.retry(exc=exc) from exc


def enqueue_transcode_low(track_id: int) -> None:
    """Queue low-bitrate transcode when Celery is available; otherwise skip."""
    from django.conf import settings

    if not getattr(settings, "TRANSCODE_LOW_ENABLED", True):
        return
    try:
        transcode_track_low_task.delay(track_id)
    except Exception:
        logger.debug("transcode enqueue skipped (broker unavailable?)", exc_info=True)
