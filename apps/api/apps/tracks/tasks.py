"""Async track import and maintenance tasks."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def import_external_track_task(self, user_id: int, url: str) -> dict:
    from apps.tracks.services.external_audio_import import ExternalImportError, import_track_from_url

    try:
        track = import_track_from_url(user_id, url)
        return {"ok": True, "track_id": track.id}
    except ExternalImportError as exc:
        return {"ok": False, "detail": exc.code}
    except Exception as exc:
        logger.exception("import_external_track_task failed")
        raise self.retry(exc=exc) from exc


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
