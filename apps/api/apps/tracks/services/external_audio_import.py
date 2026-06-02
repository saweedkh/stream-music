"""Import audio from YouTube, SoundCloud, or Spotify track links via yt-dlp."""

from __future__ import annotations

import hashlib
import ipaddress
import json
import logging
import re
import shutil
import socket
import subprocess
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.core.files import File
from django.utils import timezone

from apps.tracks.models import Track
from apps.tracks.tracks.track_serializers import TrackSerializer

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
_SPOTIFY_HOSTS = frozenset(
    {
        "open.spotify.com",
        "play.spotify.com",
    }
)
_SOUNDCLOUD_HOSTS = frozenset(
    {
        "soundcloud.com",
        "www.soundcloud.com",
        "m.soundcloud.com",
        "on.soundcloud.com",
    }
)
_STREAMING_SOURCES = frozenset({"youtube", "spotify", "soundcloud"})
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
_OEMBED_TIMEOUT = 15


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


def _resolve_source(host: str) -> str | None:
    host = host.lower()
    if host in _YOUTUBE_HOSTS:
        return "youtube"
    if host in _SPOTIFY_HOSTS:
        return "spotify"
    if host in _SOUNDCLOUD_HOSTS or host.endswith(".soundcloud.com"):
        return "soundcloud"
    return None


def is_streaming_platform_url(url: str) -> bool:
    try:
        validate_music_url(url)
        return True
    except ExternalImportError:
        return False


def validate_music_url(url: str) -> tuple[str, str]:
    """Return (normalized_url, source). Raises ExternalImportError."""
    raw = (url or "").strip()
    if not raw or len(raw) > 500:
        raise ExternalImportError("invalid_url")
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise ExternalImportError("invalid_scheme")
    host = (parsed.hostname or "").lower()
    source = _resolve_source(host)
    if not source:
        raise ExternalImportError("unsupported_host")
    _dns_safety_check(host)
    if (
        source == "youtube"
        and "youtube.com" in host
        and "/watch" not in parsed.path
        and "youtu.be" not in host
        and not re.search(r"^/watch", parsed.path)
        and "list=" not in (parsed.query or "")
    ):
        raise ExternalImportError("not_a_track_url")
    if source == "spotify" and "/track/" not in (parsed.path or ""):
        raise ExternalImportError("not_a_track_url")
    return raw, source


def _dns_safety_check(host: str) -> None:
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


def _count_recent_imports(user_id: int) -> int:
    hour_ago = timezone.now() - timezone.timedelta(hours=1)
    return Track.objects.filter(
        owner_id=user_id,
        import_source__in=_STREAMING_SOURCES,
        created_at__gte=hour_ago,
    ).count()


def _ytdlp_binary() -> str:
    ytdlp = shutil.which("yt-dlp") or shutil.which("youtube-dl")
    if not ytdlp:
        raise ExternalImportError("ytdlp_not_installed")
    return ytdlp


def _pick_audio_file(out_dir: Path) -> Path:
    files = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for f in files:
        if f.is_file() and f.suffix.lower() in {".mp3", ".m4a", ".opus", ".webm", ".ogg", ".wav"}:
            if f.stat().st_size > _max_bytes():
                raise ExternalImportError("file_too_large")
            return f
    raise ExternalImportError("no_audio_file")


def _ytdlp_extra_args() -> list[str]:
    proxy = getattr(settings, "YTDLP_PROXY", "") or ""
    if not proxy:
        return []
    return ["--proxy", proxy]


def _run_ytdlp(target: str, out_dir: Path) -> Path:
    """Download audio from a direct media URL or a ytsearch target."""
    ytdlp = _ytdlp_binary()
    template = str(out_dir / "%(ext)s.%(id)s")
    cmd = [
        ytdlp,
        *_ytdlp_extra_args(),
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
        target,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=300, text=True)
    except subprocess.TimeoutExpired as exc:
        raise ExternalImportError("download_timeout") from exc
    except subprocess.CalledProcessError as exc:
        logger.warning("yt-dlp failed: %s", (exc.stderr or "")[:500])
        raise ExternalImportError("download_failed") from exc
    return _pick_audio_file(out_dir)


def _spotify_oembed_title(url: str) -> str:
    oembed_url = "https://open.spotify.com/oembed?" + urllib.parse.urlencode({"url": url})
    req = urllib.request.Request(
        oembed_url,
        headers={"User-Agent": "StreamMusic/1.0 (+spotify-oembed)", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=_OEMBED_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError, urllib.error.URLError) as exc:
        raise ExternalImportError("spotify_metadata_failed") from exc
    title = str(payload.get("title") or "").strip()
    if not title:
        raise ExternalImportError("spotify_metadata_failed")
    return title[:200]


def _download_for_source(url: str, source: str, out_dir: Path) -> tuple[Path, str, str]:
    """Return (audio_path, default_title, default_artist)."""
    if source == "spotify":
        query = _spotify_oembed_title(url)
        target = f"ytsearch1:{query}"
        audio_path = _run_ytdlp(target, out_dir)
        artist = ""
        if " - " in query:
            parts = query.split(" - ", 1)
            if len(parts) == 2:
                return audio_path, parts[1].strip()[:255] or query[:255], parts[0].strip()[:255]
        return audio_path, query[:255], artist
    audio_path = _run_ytdlp(url, out_dir)
    stem = audio_path.stem[:255] or "Imported track"
    return audio_path, stem, ""


def import_streaming_track(
    *,
    user,
    url: str,
    title: str = "",
    visibility: str = "",
    artist: str = "",
    album: str = "",
    genre: str = "",
    tags: list[str] | None = None,
) -> tuple[dict, int, bool]:
    """Download from a streaming platform and create a Track (upload-from-url compatible)."""
    if not getattr(settings, "EXTERNAL_IMPORT_ENABLED", True):
        raise ExternalImportError("import_disabled")
    if _count_recent_imports(user.id) >= _rate_limit_per_hour():
        raise ExternalImportError("rate_limited")

    normalized, source = validate_music_url(url)
    vis = visibility or Track.Visibility.PRIVATE
    if vis not in {v for v, _ in Track.Visibility.choices}:
        raise ExternalImportError("invalid_visibility")

    with tempfile.TemporaryDirectory(prefix="sm_import_") as tmp:
        audio_path, meta_title, meta_artist = _download_for_source(normalized, source, Path(tmp))
        digest = hashlib.sha256(audio_path.read_bytes()).hexdigest()
        existing = Track.objects.filter(owner=user, file_hash=digest).first()
        if existing:
            return TrackSerializer(existing).data, 200, True

        safe_tags = [str(t).strip() for t in (tags or []) if str(t).strip()][:20]
        track_title = (title or "").strip() or meta_title or "Imported track"
        track_artist = (artist or "").strip() or meta_artist
        track = Track(
            owner=user,
            title=track_title[:255],
            artist=track_artist[:255],
            album=(album or "").strip()[:255],
            genre=(genre or "").strip()[:120],
            tags=safe_tags,
            visibility=vis,
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
        return TrackSerializer(track).data, 201, False


def import_track_from_url(user_id: int, url: str) -> Track:
    """Legacy import-external entry (private visibility, title from metadata)."""
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.get(pk=user_id)
    payload, _code, duplicate = import_streaming_track(user=user, url=url)
    if duplicate:
        return Track.objects.get(pk=payload["id"], owner_id=user_id)
    return Track.objects.get(pk=payload["id"], owner_id=user_id)
