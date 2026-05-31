"""ORM models registered under the common app (badges only)."""

from apps.accounts.badge_models import UserBadgeAssignment, UserBadgeDefinition  # noqa: F401

__all__ = ["UserBadgeDefinition", "UserBadgeAssignment"]
