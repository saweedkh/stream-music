"""Secure import of music from allowed external URLs (YouTube) via yt-dlp."""

from __future__ import annotations

import hashlib
import ipaddress
import logging
import re
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.core.files import File
from django.utils import timezone

from apps.tracks.models import Track

logger = logging.getLogger(__name__)

_YOUTUBE_HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
    }
)
_BLOCKED_NETS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


class ExternalImportError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _max_duration() -> int:
    return int(getattr(settings, "EXTERNAL_IMPORT_MAX_DURATION_SECONDS", 600))


def _max_bytes() -> int:
    return int(getattr(settings, "EXTERNAL_IMPORT_MAX_BYTES", 50 * 1024 * 1024))


def _rate_limit_per_hour() -> int:
    return int(getattr(settings, "EXTERNAL_IMPORT_RATE_PER_HOUR", 8))


def validate_music_url(url: str) -> tuple[str, str]:
    """Return (normalized_url, source). Raises ExternalImportError."""
    raw = (url or "").strip()
    if not raw or len(raw) > 500:
        raise ExternalImportError("invalid_url")
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise ExternalImportError("invalid_scheme")
    host = (parsed.hostname or "").lower()
    if host not in _YOUTUBE_HOSTS:
        raise ExternalImportError("unsupported_host")
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        for info in infos[:4]:
            ip = ipaddress.ip_address(info[4][0])
            for net in _BLOCKED_NETS:
                if ip in net:
                    raise ExternalImportError("blocked_destination")
    except ExternalImportError:
        raise
    except OSError as exc:
        logger.warning("DNS check failed for %s: %s", host, exc)
    if "youtube.com" in host and "/watch" not in parsed.path and "youtu.be" not in host:
        if not re.search(r"^/watch", parsed.path) and "list=" not in (parsed.query or ""):
            raise ExternalImportError("not_a_track_url")
    return raw, "youtube"


def _count_recent_imports(user_id: int) -> int:
    hour_ago = timezone.now() - timezone.timedelta(hours=1)
    return Track.objects.filter(
        owner_id=user_id,
        import_source="youtube",
        created_at__gte=hour_ago,
    ).count()


def _run_ytdlp(url: str, out_dir: Path) -> Path:
    ytdlp = shutil.which("yt-dlp") or shutil.which("youtube-dl")
    if not ytdlp:
        raise ExternalImportError("ytdlp_not_installed")
    template = str(out_dir / "%(id)s.%(ext)s")
    cmd = [
        ytdlp,
        "--no-playlist",
        "--max-downloads",
        "1",
        "--match-filter",
        f"duration < {_max_duration()}",
        "-f",
        "bestaudio[ext=m4a]/bestaudio/best",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "5",
        "-o",
        template,
        "--no-warnings",
        "--",
        url,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=300, text=True)
    except subprocess.TimeoutExpired as exc:
        raise ExternalImportError("download_timeout") from exc
    except subprocess.CalledProcessError as exc:
        logger.warning("yt-dlp failed: %s", (exc.stderr or "")[:500])
        raise ExternalImportError("download_failed") from exc
    files = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for f in files:
        if f.is_file() and f.suffix.lower() in {".mp3", ".m4a", ".opus", ".webm", ".ogg"}:
            if f.stat().st_size > _max_bytes():
                raise ExternalImportError("file_too_large")
            return f
    raise ExternalImportError("no_audio_file")


def import_track_from_url(user_id: int, url: str) -> Track:
    if not getattr(settings, "EXTERNAL_IMPORT_ENABLED", True):
        raise ExternalImportError("import_disabled")
    if _count_recent_imports(user_id) >= _rate_limit_per_hour():
        raise ExternalImportError("rate_limited")
    normalized, source = validate_music_url(url)
    with tempfile.TemporaryDirectory(prefix="sm_import_") as tmp:
        audio_path = _run_ytdlp(normalized, Path(tmp))
        digest = hashlib.sha256(audio_path.read_bytes()).hexdigest()
        existing = Track.objects.filter(owner_id=user_id, file_hash=digest).first()
        if existing:
            return existing
        title = audio_path.stem[:255] or "Imported track"
        track = Track(
            owner_id=user_id,
            title=title,
            artist="",
            duration_seconds=0,
            file_hash=digest,
            import_source=source,
            source_url=normalized[:500],
        )
        with audio_path.open("rb") as fh:
            track.file.save(audio_path.name, File(fh), save=False)
        track.save()
        from apps.tracks.tasks import enqueue_transcode_low

        enqueue_transcode_low(track.id)
        return track
