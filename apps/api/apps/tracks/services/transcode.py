"""Generate a lower-bitrate `file_low` copy via ffmpeg when available."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files import File

from apps.tracks.models import Track

logger = logging.getLogger(__name__)


class TranscodeError(Exception):
    pass


def _ffmpeg_path() -> str | None:
    custom = getattr(settings, "TRANSCODE_FFMPEG_PATH", "").strip()
    if custom:
        return custom
    return shutil.which("ffmpeg")


def transcode_track_low(track_id: int, *, force: bool = False) -> bool:
    """
    Create `Track.file_low` from `Track.file`. Returns True if a file was written.
    Skips when ffmpeg is missing, transcode is disabled, or file_low already exists.
    """
    if not getattr(settings, "TRANSCODE_LOW_ENABLED", True):
        return False
    if not _ffmpeg_path():
        logger.info("transcode skipped: ffmpeg not found")
        return False

    track = Track.objects.filter(id=track_id).first()
    if track is None or not track.file:
        return False
    if track.file_low and not force:
        return False

    src = Path(track.file.path)
    if not src.is_file():
        raise TranscodeError("source_missing")

    bitrate = getattr(settings, "TRANSCODE_LOW_BITRATE", "128k")
    with tempfile.TemporaryDirectory(prefix="sm_transcode_") as tmp:
        out = Path(tmp) / f"{track.id}_low.mp3"
        cmd = [
            _ffmpeg_path(),
            "-y",
            "-i",
            str(src),
            "-vn",
            "-acodec",
            "libmp3lame",
            "-b:a",
            bitrate,
            str(out),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=600, text=True)
        except subprocess.TimeoutExpired as exc:
            raise TranscodeError("timeout") from exc
        except subprocess.CalledProcessError as exc:
            logger.warning("ffmpeg failed: %s", (exc.stderr or "")[:400])
            raise TranscodeError("ffmpeg_failed") from exc

        if not out.is_file() or out.stat().st_size < 1:
            raise TranscodeError("empty_output")

        if track.file_low:
            track.file_low.delete(save=False)
        with out.open("rb") as fh:
            track.file_low.save(f"{track.id}_low.mp3", File(fh), save=True)
    return True
