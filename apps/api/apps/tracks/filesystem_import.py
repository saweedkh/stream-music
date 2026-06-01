"""Import audio into MEDIA_ROOT and register Track rows."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.utils.text import slugify

from apps.tracks.models import Track

User = get_user_model()

AUDIO_SUFFIXES = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".webm"}


def import_audio_files_under_media(owner: User, *, subdirectory: str | None = None) -> dict[str, list]:
    """
    Scan ``MEDIA_ROOT/audio/`` (optional subdirectory under ``audio/``) and create Track rows
    for files not already registered with the same storage path.

    Returns: {"created": [ { "id", "title", "file" }, ... ], "skipped": [ str paths ], "errors": [ str ]}
    """
    media_root = Path(settings.MEDIA_ROOT)
    audio_root = media_root / "audio"
    if subdirectory:
        sub = subdirectory.strip().strip("/").replace("\\", "/")
        if ".." in sub or sub.startswith("/"):
            return {"created": [], "skipped": [], "errors": ["invalid_subdirectory"]}
        audio_root = audio_root / sub

    created: list[dict] = []
    skipped: list[str] = []
    errors: list[str] = []

    if not audio_root.is_dir():
        errors.append(f"missing_directory:{audio_root}")
        return {"created": [], "skipped": [], "errors": errors}

    for path in sorted(audio_root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in AUDIO_SUFFIXES:
            continue
        rel = os.path.relpath(os.path.abspath(path), os.path.abspath(media_root)).replace("\\", "/")
        if rel.startswith(".."):
            errors.append(f"outside_media:{path}")
            continue

        if Track.objects.filter(file=rel).exists():
            skipped.append(rel)
            continue

        title = path.stem.replace("_", " ").replace("-", " ").strip() or path.stem
        try:
            track = Track(
                owner=owner,
                title=title[:255],
                visibility=Track.Visibility.PRIVATE,
            )
            with path.open("rb") as fh:
                track.file.save(path.name, File(fh), save=True)
            created.append({"id": track.id, "title": track.title, "file": track.file.name})
        except Exception as exc:
            errors.append(f"{rel}:{exc!s}")

    return {"created": created, "skipped": skipped, "errors": errors}


def import_audio_from_system_directory(
    owner: User,
    source_dir: str | os.PathLike[str],
    *,
    visibility: str = Track.Visibility.PUBLIC_LAN,
    dry_run: bool = False,
) -> dict[str, list]:
    """
    Copy audio files from any folder on disk into ``MEDIA_ROOT/audio/imports/<stable-id>/…``
    and create Track rows (default visibility ``public_lan``: visible to all logged-in users).

    Returns: ``{"created": [...], "skipped": [...], "errors": [...]}``
    """
    created: list[dict] = []
    skipped: list[str] = []
    errors: list[str] = []

    source = Path(source_dir).expanduser().resolve()
    if not source.is_dir():
        errors.append(f"not_a_directory:{source}")
        return {"created": [], "skipped": [], "errors": errors}

    media_root = Path(settings.MEDIA_ROOT).resolve()
    media_root.mkdir(parents=True, exist_ok=True)

    path_key = hashlib.sha256(str(source).encode()).hexdigest()[:12]
    folder_slug = slugify(source.name) or "music"
    dest_prefix = Path("audio") / "imports" / f"{folder_slug}-{path_key}"

    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in AUDIO_SUFFIXES:
            continue

        try:
            rel_under_import = path.relative_to(source)
        except ValueError:
            errors.append(f"outside_source:{path}")
            continue

        rel_storage = (dest_prefix / rel_under_import).as_posix().replace("\\", "/")
        planned_abs = (media_root / rel_storage).resolve()

        try:
            planned_abs.relative_to(media_root)
        except ValueError:
            errors.append(f"outside_media:{planned_abs}")
            continue

        if Track.objects.filter(file=rel_storage).exists():
            skipped.append(rel_storage)
            continue

        title = path.stem.replace("_", " ").replace("-", " ").strip() or path.stem

        if dry_run:
            created.append({"id": None, "title": title[:255], "file": rel_storage, "dry_run": True})
            continue

        try:
            planned_abs.parent.mkdir(parents=True, exist_ok=True)
            track = Track(
                owner=owner,
                title=title[:255],
                visibility=visibility,
            )
            with path.open("rb") as fh:
                track.file.save(rel_storage, File(fh), save=True)
            created.append({"id": track.id, "title": track.title, "file": track.file.name})
        except Exception as exc:
            errors.append(f"{rel_storage}:{exc!s}")

    return {"created": created, "skipped": skipped, "errors": errors}
