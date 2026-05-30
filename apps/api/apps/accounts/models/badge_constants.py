"""Badge slugs and field choices (not ORM models)."""

from __future__ import annotations

SLUG_PLATFORM_SUPERUSER = "platform_superuser"
SLUG_PLATFORM_STAFF = "platform_staff"
SLUG_PREMIUM = "premium"

SYSTEM_BADGE_SLUGS = frozenset({SLUG_PLATFORM_SUPERUSER, SLUG_PLATFORM_STAFF, SLUG_PREMIUM})

ICON_CHOICES = [
    ("badge-check", "Verified tick"),
    ("crown", "Crown"),
    ("sparkles", "Sparkles"),
    ("star", "Star"),
    ("shield", "Shield"),
    ("music", "Music"),
    ("heart", "Heart"),
    ("zap", "Zap"),
    ("gem", "Gem"),
]

COLOR_CHOICES = [
    ("sky", "Sky blue"),
    ("amber", "Gold"),
    ("violet", "Violet"),
    ("emerald", "Emerald"),
    ("rose", "Rose"),
    ("brand", "Brand green"),
    ("slate", "Slate"),
]
