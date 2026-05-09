"""Temporary disk + cache metadata for resumable track uploads."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from django.conf import settings
from django.core.cache import cache

_CACHE_PREFIX = "track_chunk_meta:"
_DEFAULT_TTL = 60 * 60 * 24  # 24 hours


def _chunk_root() -> Path:
    return Path(settings.CHUNK_UPLOAD_ROOT)


def _max_bytes() -> int:
    return int(getattr(settings, "CHUNK_UPLOAD_MAX_BYTES", 500 * 1024 * 1024))


def _max_chunk_bytes() -> int:
    return int(getattr(settings, "CHUNK_UPLOAD_CHUNK_MAX_BYTES", 8 * 1024 * 1024))


def sanitize_audio_filename(name: str) -> str:
    base = os.path.basename(name or "audio")
    base = re.sub(r"[^a-zA-Z0-9._\-]", "_", base)[:180]
    if not base.lower().endswith((".mp3", ".ogg", ".wav", ".m4a", ".flac", ".aac", ".webm", ".opus")):
        base = f"{base}.bin"
    return base or "audio.bin"


def init_session(*, user_id: int, filename: str, size: int, meta: dict) -> str:
    if size <= 0 or size > _max_bytes():
        raise ValueError("invalid_size")
    upload_id = str(uuid.uuid4())
    root = _chunk_root() / upload_id
    root.mkdir(parents=True, exist_ok=True)
    path = root / "upload.bin"
    path.touch(exist_ok=True)
    safe_name = sanitize_audio_filename(filename)
    payload = {
        "user_id": user_id,
        "path": str(path),
        "size": size,
        "filename": safe_name,
        **meta,
    }
    cache.set(_CACHE_PREFIX + upload_id, payload, timeout=_DEFAULT_TTL)
    return upload_id


def get_session(upload_id: str) -> dict | None:
    return cache.get(_CACHE_PREFIX + upload_id)


def delete_session(upload_id: str) -> None:
    cache.delete(_CACHE_PREFIX + upload_id)


def append_chunk(*, upload_id: str, user_id: int, data: bytes) -> dict:
    if len(data) > _max_chunk_bytes():
        raise ValueError("chunk_too_large")
    meta = get_session(upload_id)
    if not meta or meta.get("user_id") != user_id:
        raise PermissionError("invalid_session")
    path = Path(meta["path"])
    current = path.stat().st_size if path.exists() else 0
    expected = int(meta["size"])
    if current + len(data) > expected:
        raise ValueError("size_exceeded")
    with open(path, "ab") as f:
        f.write(data)
    meta_after = dict(meta)
    meta_after["written"] = path.stat().st_size
    cache.set(_CACHE_PREFIX + upload_id, meta_after, timeout=_DEFAULT_TTL)
    return meta_after


def finalize_path(upload_id: str, *, user_id: int) -> dict:
    meta = get_session(upload_id)
    if not meta or meta.get("user_id") != user_id:
        raise PermissionError("invalid_session")
    path = Path(meta["path"])
    if not path.exists() or path.stat().st_size != int(meta["size"]):
        raise ValueError("incomplete_upload")
    return meta


def cleanup_files(upload_id: str) -> None:
    meta = get_session(upload_id)
    if not meta:
        return
    path = Path(meta["path"])
    parent = path.parent
    try:
        if path.exists():
            path.unlink()
        if parent.exists():
            parent.rmdir()
    except OSError:
        pass
    delete_session(upload_id)
