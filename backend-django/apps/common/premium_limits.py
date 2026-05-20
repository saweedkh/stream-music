"""Platform limits; premium users get higher caps via badge slug `premium`."""

from __future__ import annotations

from django.contrib.auth.models import User

from apps.channels.models import Channel
from apps.common.account_badges import SLUG_PREMIUM
from apps.common.user_badges import badges_for_user

FREE_MAX_OWNED_CHANNELS = 5
PREMIUM_MAX_OWNED_CHANNELS = 50

FREE_MAX_CHANNEL_MEMBERS = 50
PREMIUM_MAX_CHANNEL_MEMBERS = 200


def user_has_premium(user: User) -> bool:
    slugs = {b["slug"] for b in badges_for_user(user)}
    return SLUG_PREMIUM in slugs or user.is_superuser


def max_owned_channels(user: User) -> int:
    return PREMIUM_MAX_OWNED_CHANNELS if user_has_premium(user) else FREE_MAX_OWNED_CHANNELS


def max_channel_member_limit(user: User) -> int:
    return PREMIUM_MAX_CHANNEL_MEMBERS if user_has_premium(user) else FREE_MAX_CHANNEL_MEMBERS


def can_create_channel(user: User) -> tuple[bool, str | None]:
    owned = Channel.objects.filter(owner_id=user.id).count()
    cap = max_owned_channels(user)
    if owned >= cap:
        return False, "channel_limit_reached"
    return True, None


def clamp_member_limit(user: User, requested: int) -> int:
    cap = max_channel_member_limit(user)
    return max(1, min(int(requested or cap), cap))


def track_owner_is_premium(track) -> bool:
    owner = getattr(track, "owner", None)
    if owner is None and getattr(track, "owner_id", None):
        owner = User.objects.filter(id=track.owner_id).first()
    if owner is None:
        return False
    return user_has_premium(owner)
