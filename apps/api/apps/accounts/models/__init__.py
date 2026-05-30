"""Account ORM models — one module per model class."""

from apps.accounts.models.badge_constants import (
    COLOR_CHOICES,
    ICON_CHOICES,
    SLUG_PLATFORM_STAFF,
    SLUG_PLATFORM_SUPERUSER,
    SLUG_PREMIUM,
    SYSTEM_BADGE_SLUGS,
)
from apps.accounts.models.user_badge_assignment import UserBadgeAssignment
from apps.accounts.models.user_badge_definition import UserBadgeDefinition
from apps.accounts.models.user_playlist_favorite import UserPlaylistFavorite
from apps.accounts.models.user_track_favorite import UserTrackFavorite

__all__ = [
    "COLOR_CHOICES",
    "ICON_CHOICES",
    "SLUG_PLATFORM_STAFF",
    "SLUG_PLATFORM_SUPERUSER",
    "SLUG_PREMIUM",
    "SYSTEM_BADGE_SLUGS",
    "UserBadgeAssignment",
    "UserBadgeDefinition",
    "UserPlaylistFavorite",
    "UserTrackFavorite",
]
