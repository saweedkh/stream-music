"""Validate and assign user profile avatars (static images and GIF)."""

from __future__ import annotations

import os

from django.core.exceptions import ValidationError

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    }
)
ALLOWED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".gif", ".webp"})
MAX_AVATAR_BYTES = 5 * 1024 * 1024


def validate_avatar_upload(uploaded_file) -> None:
    if not uploaded_file:
        raise ValidationError("avatar_required")
    size = int(getattr(uploaded_file, "size", 0) or 0)
    if size <= 0:
        raise ValidationError("avatar_invalid")
    if size > MAX_AVATAR_BYTES:
        raise ValidationError("avatar_too_large")
    content_type = (getattr(uploaded_file, "content_type", None) or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError("avatar_invalid")
    name = (getattr(uploaded_file, "name", None) or "").lower()
    ext = os.path.splitext(name)[1]
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise ValidationError("avatar_invalid")


def avatar_url_for(profile, *, request=None) -> str | None:
    if not profile or not profile.avatar:
        return None
    url = profile.avatar.url
    updated = getattr(profile, "updated_at", None)
    if updated is not None:
        version = int(updated.timestamp())
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}v={version}"
    return url


def avatar_urls_for_user_ids(user_ids) -> dict[int, str | None]:
    from apps.social.models import UserPublicProfile

    ids = sorted({int(uid) for uid in user_ids if uid})
    if not ids:
        return {}
    out: dict[int, str | None] = dict.fromkeys(ids, None)
    rows = UserPublicProfile.objects.filter(user_id__in=ids).exclude(avatar="").only(
        "user_id",
        "avatar",
        "updated_at",
    )
    for profile in rows:
        if profile.avatar:
            out[profile.user_id] = avatar_url_for(profile)
    return out


def avatar_url_for_user_id(user_id: int | None) -> str | None:
    if not user_id:
        return None
    return avatar_urls_for_user_ids([user_id]).get(int(user_id))
