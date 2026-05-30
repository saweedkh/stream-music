"""Channel room experience and join-link validation constants."""

from __future__ import annotations

import re

ALLOWED_EXPERIENCE_KEYS = frozenset(
    {
        "accent",
        "rehearsal_mode",
        "rehearsal_lift_until",
        "queue_locked",
        "blind_playlist_id",
        "intro_preview_seconds",
        "veto_skip_threshold",
        "anti_repeat_window",
        "weighted_shuffle_bias",
        "suggestions_enabled",
        "suggestion_rate_limit_per_hour",
        "chat_slow_mode_seconds",
        "theme_primary",
        "theme_surface",
        "theme_font",
        "listening_party_only",
        "radio_mode",
        "scheduled_start_at",
        "queue_end_mode",
        "room_rules",
        "chat_word_filters",
    },
)

UUID_TOKEN_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
PUBLIC_JOIN_CODE_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9-]{2,39}$")
PUBLIC_JOIN_RESERVED = frozenset(
    {
        "join",
        "api",
        "www",
        "static",
        "channel",
        "dashboard",
        "login",
        "register",
        "admin",
        "media",
        "audio",
        "private",
        "public",
        "invite",
        "ws",
        "app",
        "next",
    },
)
