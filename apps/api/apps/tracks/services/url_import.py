"""Secure remote audio fetch for URL-based track import."""

from __future__ import annotations

import hashlib
import http.client
import ipaddress
import os
import socket
import ssl
import tempfile
import urllib.parse
from pathlib import Path

from django.conf import settings
from django.core.files import File

from apps.tracks.api.serializers import TrackSerializer
from apps.tracks.chunk_upload import sanitize_audio_filename
from apps.tracks.models import Track

_ALLOWED_SCHEMES = frozenset({"http", "https"})
_BLOCKED_HOSTNAMES = frozenset(
    {
        "localhost",
        "localhost.localdomain",
        "metadata.google.internal",
        "metadata",
    }
)
_AUDIO_EXTENSIONS = (".mp3", ".ogg", ".wav", ".m4a", ".flac", ".aac", ".webm", ".opus")
_MAGIC_PREFIXES = (
    b"ID3",
    b"\xff\xfb",
    b"\xff\xf3",
    b"\xff\xf2",
    b"OggS",
    b"RIFF",
    b"fLaC",
    b"\x00\x00\x00",
)
_MAX_REDIRECTS = 3
_DEFAULT_TIMEOUT_SECONDS = 120
_FETCH_HEADERS = {
    "User-Agent": "StreamMusic/1.0 (+url-import)",
    "Accept": "audio/*,application/octet-stream",
}


def _request_timeout_seconds() -> int:
    """Always return a plain int — never a (connect, read) tuple."""
    raw = getattr(settings, "URL_IMPORT_TIMEOUT", _DEFAULT_TIMEOUT_SECONDS)
    if isinstance(raw, (list, tuple)):
        return int(raw[-1])
    return int(raw)


def _max_bytes() -> int:
    return int(getattr(settings, "URL_IMPORT_MAX_BYTES", getattr(settings, "CHUNK_UPLOAD_MAX_BYTES", 200 * 1024 * 1024)))


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _resolve_host_ips(hostname: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("host_unreachable") from exc
    ips: list[str] = []
    for info in infos:
        addr = info[4][0]
        if addr not in ips:
            ips.append(addr)
    if not ips:
        raise ValueError("host_unreachable")
    return ips


def validate_remote_url(url: str) -> urllib.parse.ParseResult:
    raw = (url or "").strip()
    if not raw or len(raw) > 2048:
        raise ValueError("invalid_url")
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError("invalid_scheme")
    hostname = (parsed.hostname or "").strip().lower().rstrip(".")
    if not hostname:
        raise ValueError("invalid_url")
    if parsed.username or parsed.password:
        raise ValueError("credentials_not_allowed")
    if hostname in _BLOCKED_HOSTNAMES or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise ValueError("host_not_allowed")
    if hostname.endswith(".localhost"):
        raise ValueError("host_not_allowed")
    for ip_str in _resolve_host_ips(hostname):
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError as exc:
            raise ValueError("host_not_allowed") from exc
        if _is_blocked_ip(ip):
            raise ValueError("host_not_allowed")
    return parsed


def _filename_from_url(parsed: urllib.parse.ParseResult) -> str:
    path = urllib.parse.unquote(parsed.path or "")
    name = os.path.basename(path) or "remote-audio.mp3"
    return sanitize_audio_filename(name)


def _looks_like_audio(data: bytes) -> bool:
    if len(data) < 4:
        return False
    if data[:4] == b"ftyp":
        return True
    if data[4:8] == b"ftyp":
        return True
    return any(data.startswith(prefix) for prefix in _MAGIC_PREFIXES)


def _read_limited_body(resp: http.client.HTTPResponse, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        block = resp.read(1024 * 256)
        if not block:
            break
        total += len(block)
        if total > max_bytes:
            raise ValueError("file_too_large")
        chunks.append(block)
    body = b"".join(chunks)
    if not body:
        raise ValueError("empty_file")
    return body


def _fetch_with_redirect_guard(url: str) -> tuple[bytes, str, str]:
    current = url
    timeout = _request_timeout_seconds()
    for _ in range(_MAX_REDIRECTS + 1):
        parsed = validate_remote_url(current)
        filename = _filename_from_url(parsed)
        host = parsed.hostname or ""
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"

        if parsed.scheme == "https":
            conn: http.client.HTTPConnection = http.client.HTTPSConnection(
                host,
                port,
                timeout=timeout,
                context=ssl.create_default_context(),
            )
        else:
            conn = http.client.HTTPConnection(host, port, timeout=timeout)

        try:
            conn.request("GET", path, headers=_FETCH_HEADERS)
            resp = conn.getresponse()
            try:
                if resp.status in {301, 302, 303, 307, 308}:
                    location = resp.getheader("Location")
                    resp.read()
                    if not location:
                        raise ValueError("invalid_redirect")
                    current = urllib.parse.urljoin(current, location)
                    continue
                if resp.status < 200 or resp.status >= 300:
                    raise ValueError("fetch_failed")

                content_type = (resp.getheader("Content-Type") or "").split(";")[0].strip().lower()
                if content_type and not (
                    content_type.startswith("audio/")
                    or content_type in {"application/octet-stream", "binary/octet-stream", "application/ogg"}
                ):
                    raise ValueError("invalid_content_type")

                body = _read_limited_body(resp, _max_bytes())
                if not _looks_like_audio(body):
                    raise ValueError("invalid_audio")
                return body, filename, content_type or "application/octet-stream"
            finally:
                resp.close()
        except OSError as exc:
            raise ValueError("fetch_failed") from exc
        finally:
            conn.close()
    raise ValueError("too_many_redirects")


def import_track_from_url(
    *,
    user,
    url: str,
    title: str,
    visibility: str,
    artist: str = "",
    album: str = "",
    genre: str = "",
    tags: list[str] | None = None,
) -> tuple[dict, int, bool]:
    """Download remote audio and create a Track. Returns (payload, status_code, is_duplicate)."""
    if not (title or "").strip():
        raise ValueError("title_required")
    if visibility not in {v for v, _ in Track.Visibility.choices}:
        raise ValueError("invalid_visibility")

    body, filename, _content_type = _fetch_with_redirect_guard(url.strip())
    file_hash = hashlib.sha256(body).hexdigest()
    existing = Track.objects.filter(owner=user, file_hash=file_hash).first()
    if existing:
        return TrackSerializer(existing).data, 200, True

    safe_tags = [str(t).strip() for t in (tags or []) if str(t).strip()][:20]
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix or ".bin") as tmp:
        tmp.write(body)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as fh:
            django_file = File(fh, name=os.path.basename(filename))
            track = Track.objects.create(
                owner=user,
                title=title.strip(),
                artist=(artist or "").strip(),
                album=(album or "").strip(),
                genre=(genre or "").strip()[:120],
                tags=safe_tags,
                visibility=visibility,
                file_hash=file_hash,
                file=django_file,
            )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return TrackSerializer(track).data, 201, False
