"""Validate and assign channel brand logos (images, GIF, short video → looping GIF)."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

IMAGE_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    }
)
VIDEO_CONTENT_TYPES = frozenset(
    {
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-m4v",
    }
)
IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".gif", ".webp"})
VIDEO_EXTENSIONS = frozenset({".mp4", ".webm", ".mov", ".m4v"})

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 20 * 1024 * 1024
MAX_OUTPUT_GIF_BYTES = 8 * 1024 * 1024
MAX_VIDEO_SECONDS = 8
MAX_GIF_WIDTH = 480
GIF_FPS = 12


def _ext(name: str) -> str:
    return os.path.splitext((name or "").lower())[1]


def _is_video(uploaded_file) -> bool:
    content_type = (getattr(uploaded_file, "content_type", None) or "").split(";")[0].strip().lower()
    ext = _ext(getattr(uploaded_file, "name", "") or "")
    if content_type in VIDEO_CONTENT_TYPES:
        return True
    return bool(ext and ext in VIDEO_EXTENSIONS)


def validate_brand_logo_upload(uploaded_file) -> None:
    if not uploaded_file:
        raise ValidationError("brand_logo_required")
    size = int(getattr(uploaded_file, "size", 0) or 0)
    if size <= 0:
        raise ValidationError("brand_logo_invalid")
    if _is_video(uploaded_file):
        if size > MAX_VIDEO_BYTES:
            raise ValidationError("brand_logo_video_too_large")
        return
    if size > MAX_IMAGE_BYTES:
        raise ValidationError("brand_logo_too_large")
    content_type = (getattr(uploaded_file, "content_type", None) or "").split(";")[0].strip().lower()
    ext = _ext(getattr(uploaded_file, "name", "") or "")
    if content_type and content_type not in IMAGE_CONTENT_TYPES:
        raise ValidationError("brand_logo_invalid")
    if ext and ext not in IMAGE_EXTENSIONS and ext not in VIDEO_EXTENSIONS:
        raise ValidationError("brand_logo_invalid")


def _ffmpeg_path() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise ValidationError("brand_logo_ffmpeg_missing")
    return path


def video_to_gif_bytes(uploaded_file) -> bytes:
    ffmpeg = _ffmpeg_path()
    with tempfile.TemporaryDirectory(prefix="ch_brand_") as tmp:
        in_name = Path(getattr(uploaded_file, "name", "") or "upload.mp4").name
        in_path = Path(tmp) / in_name
        out_path = Path(tmp) / "brand.gif"
        with open(in_path, "wb") as fh:
            if hasattr(uploaded_file, "chunks"):
                for chunk in uploaded_file.chunks():
                    fh.write(chunk)
            else:
                fh.write(uploaded_file.read())
            if hasattr(uploaded_file, "seek"):
                uploaded_file.seek(0)
        vf = (
            f"fps={GIF_FPS},scale={MAX_GIF_WIDTH}:-1:flags=lanczos,"
            "split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer"
        )
        try:
            proc = subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-i",
                    str(in_path),
                    "-t",
                    str(MAX_VIDEO_SECONDS),
                    "-vf",
                    vf,
                    "-loop",
                    "0",
                    str(out_path),
                ],
                capture_output=True,
                timeout=90,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise ValidationError("brand_logo_video_too_long") from None
        if proc.returncode != 0:
            raise ValidationError("brand_logo_invalid")
        if not out_path.is_file() or out_path.stat().st_size <= 0:
            raise ValidationError("brand_logo_invalid")
        data = out_path.read_bytes()
        if len(data) > MAX_OUTPUT_GIF_BYTES:
            raise ValidationError("brand_logo_too_large")
        return data


def clear_channel_brand_logo(channel) -> None:
    if channel.brand_logo:
        channel.brand_logo.delete(save=False)
        channel.brand_logo = None


def assign_channel_brand_logo(channel, uploaded_file) -> None:
    validate_brand_logo_upload(uploaded_file)
    if channel.brand_logo:
        channel.brand_logo.delete(save=False)
    if _is_video(uploaded_file):
        gif_bytes = video_to_gif_bytes(uploaded_file)
        channel.brand_logo.save(
            f"channel_{channel.id}.gif",
            ContentFile(gif_bytes),
            save=False,
        )
    else:
        name = getattr(uploaded_file, "name", None) or "logo"
        channel.brand_logo.save(name, uploaded_file, save=False)


def brand_logo_url_for(channel) -> str | None:
    if not channel.brand_logo:
        return None
    url = channel.brand_logo.url
    updated = getattr(channel, "updated_at", None)
    if updated is not None:
        version = int(updated.timestamp())
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}v={version}"
    return url
