"""API token creation and authentication."""

from __future__ import annotations

import secrets

from django.contrib.auth.models import User

from apps.integrations.models import UserApiToken


def create_api_token(user_id: int, name: str, scopes: list[str] | None = None) -> tuple[UserApiToken, str]:
    raw = f"sm_{secrets.token_urlsafe(32)}"
    row = UserApiToken.objects.create(
        user_id=user_id,
        name=name[:120],
        token_hash=UserApiToken.hash_token(raw),
        token_prefix=raw[:12],
        scopes=scopes or ["read:channels"],
    )
    return row, raw


def user_from_bearer_token(authorization: str | None) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    raw = authorization[7:].strip()
    if not raw.startswith("sm_"):
        return None
    digest = UserApiToken.hash_token(raw)
    row = UserApiToken.objects.filter(token_hash=digest, is_active=True).select_related("user").first()
    if row is None:
        return None
    from django.utils import timezone

    UserApiToken.objects.filter(pk=row.pk).update(last_used_at=timezone.now())
    return row.user
