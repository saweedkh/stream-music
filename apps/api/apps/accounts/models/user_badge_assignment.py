"""User ↔ badge assignment rows."""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.accounts.models.user_badge_definition import UserBadgeDefinition


class UserBadgeAssignment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="badge_assignments")
    badge = models.ForeignKey(UserBadgeDefinition, on_delete=models.CASCADE, related_name="assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="badges_assigned",
    )

    class Meta:
        db_table = "common_userbadgeassignment"
        unique_together = ("user", "badge")
        indexes = [models.Index(fields=["user", "badge"], name="common_user_user_id_badge_idx")]
