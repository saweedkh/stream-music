"""ORM models registered under the common app (badges only)."""

from apps.common.account_badges import UserBadgeAssignment, UserBadgeDefinition

__all__ = ["UserBadgeDefinition", "UserBadgeAssignment"]
