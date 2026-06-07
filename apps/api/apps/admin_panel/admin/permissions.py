"""Shared admin API permissions."""

from __future__ import annotations

from rest_framework import permissions

from apps.accounts.user_badges import is_platform_superuser


class SuperuserRequired(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_platform_superuser(request.user)
