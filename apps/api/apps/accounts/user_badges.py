"""Resolve display badges for users (manual assignments + platform rules)."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.utils import ProgrammingError

from apps.accounts.models import (
    SLUG_PLATFORM_STAFF,
    SLUG_PLATFORM_SUPERUSER,
    SLUG_PREMIUM,
    UserBadgeAssignment,
    UserBadgeDefinition,
)


def is_platform_superuser(user) -> bool:
    return bool(getattr(user, "is_authenticated", False) and getattr(user, "is_superuser", False))


def serialize_badge(badge: UserBadgeDefinition) -> dict:
    return {
        "slug": badge.slug,
        "label": badge.label,
        "description": badge.description,
        "icon": badge.icon,
        "color": badge.color,
        "priority": badge.priority,
        "is_system": badge.is_system,
    }


def _auto_system_slugs(user) -> set[str]:
    slugs: set[str] = set()
    if getattr(user, "is_superuser", False):
        slugs.add(SLUG_PLATFORM_SUPERUSER)
    elif getattr(user, "is_staff", False):
        slugs.add(SLUG_PLATFORM_STAFF)
    return slugs


def _legacy_badge_list(user) -> list[dict]:
    """Fallback when badge tables are not migrated yet."""
    badges: list[dict] = []
    if getattr(user, "is_superuser", False):
        badges.append(
            {
                "slug": SLUG_PLATFORM_SUPERUSER,
                "label": "Platform admin",
                "icon": "crown",
                "color": "amber",
                "priority": 10,
                "is_system": True,
            }
        )
    elif getattr(user, "is_staff", False):
        badges.append(
            {
                "slug": SLUG_PLATFORM_STAFF,
                "label": "Staff",
                "icon": "badge-check",
                "color": "sky",
                "priority": 20,
                "is_system": True,
            }
        )
    return badges


def badges_for_user(user) -> list[dict]:
    """All visible badges for API payloads, sorted by priority."""
    if user is None or not getattr(user, "is_authenticated", False):
        return []

    try:
        assigned_rows = (
            UserBadgeAssignment.objects.filter(user_id=user.id, badge__is_active=True)
            .select_related("badge")
            .order_by("badge__priority", "badge__slug")
        )
        by_slug: dict[str, dict] = {}
        for row in assigned_rows:
            by_slug[row.badge.slug] = serialize_badge(row.badge)

        auto_slugs = _auto_system_slugs(user)
        for slug in auto_slugs:
            if slug in by_slug:
                continue
            defn = UserBadgeDefinition.objects.filter(slug=slug, is_active=True).first()
            if defn:
                by_slug[slug] = serialize_badge(defn)

        return sorted(by_slug.values(), key=lambda b: (b["priority"], b["slug"]))
    except ProgrammingError:
        return _legacy_badge_list(user)


def user_badge_flags(user) -> dict:
    """Legacy boolean flags derived from resolved badges (for gradual migration)."""
    badges = badges_for_user(user)
    slugs = {b["slug"] for b in badges}
    return {
        "is_superuser": SLUG_PLATFORM_SUPERUSER in slugs or bool(getattr(user, "is_superuser", False)),
        "is_staff": SLUG_PLATFORM_STAFF in slugs
        or (bool(getattr(user, "is_staff", False)) and SLUG_PLATFORM_SUPERUSER not in slugs),
        "is_premium": SLUG_PREMIUM in slugs,
        "badges": badges,
    }


MANUAL_EXCLUDED_SLUGS = frozenset({SLUG_PLATFORM_SUPERUSER, SLUG_PLATFORM_STAFF})


def set_user_manual_badges(user_id: int, slugs: list[str], *, assigned_by_id: int | None = None) -> list[dict]:
    """Replace assignable badges (custom, premium, etc.). Staff/superuser slugs come from Django flags."""
    user = User.objects.filter(id=user_id).first()
    if user is None:
        return []

    valid_slugs = []
    for raw in slugs:
        s = str(raw).strip().lower()
        if not s or s in MANUAL_EXCLUDED_SLUGS:
            continue
        valid_slugs.append(s)

    definitions = {
        b.slug: b
        for b in UserBadgeDefinition.objects.filter(slug__in=valid_slugs, is_active=True).exclude(
            slug__in=MANUAL_EXCLUDED_SLUGS
        )
    }

    UserBadgeAssignment.objects.filter(user_id=user_id).exclude(badge__slug__in=MANUAL_EXCLUDED_SLUGS).delete()

    for slug in valid_slugs:
        defn = definitions.get(slug)
        if defn is None:
            continue
        UserBadgeAssignment.objects.get_or_create(
            user_id=user_id,
            badge_id=defn.id,
            defaults={"assigned_by_id": assigned_by_id},
        )

    return badges_for_user(user)


def badges_for_users(users: list) -> dict[int, list[dict]]:
    """Bulk-resolve badges for list endpoints."""
    if not users:
        return {}
    try:
        user_ids = [u.id for u in users]
        by_user: dict[int, dict[str, dict]] = {uid: {} for uid in user_ids}
        rows = (
            UserBadgeAssignment.objects.filter(user_id__in=user_ids, badge__is_active=True)
            .select_related("badge")
            .order_by("badge__priority", "badge__slug")
        )
        for row in rows:
            by_user[row.user_id][row.badge.slug] = serialize_badge(row.badge)

        system_defns = {b.slug: b for b in UserBadgeDefinition.objects.filter(is_active=True)}
        out: dict[int, list[dict]] = {}
        for u in users:
            merged = dict(by_user.get(u.id, {}))
            for slug in _auto_system_slugs(u):
                if slug not in merged and slug in system_defns:
                    merged[slug] = serialize_badge(system_defns[slug])
            out[u.id] = sorted(merged.values(), key=lambda b: (b["priority"], b["slug"]))
        return out
    except ProgrammingError:
        return {u.id: _legacy_badge_list(u) for u in users}
