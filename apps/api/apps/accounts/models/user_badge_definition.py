"""Admin-defined and system badge definitions."""

from __future__ import annotations

from django.db import models

from apps.accounts.models.badge_constants import COLOR_CHOICES, ICON_CHOICES


class UserBadgeDefinition(models.Model):
    slug = models.SlugField(max_length=40, unique=True)
    label = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True, default="")
    icon = models.CharField(max_length=32, choices=ICON_CHOICES, default="badge-check")
    color = models.CharField(max_length=24, choices=COLOR_CHOICES, default="sky")
    priority = models.PositiveSmallIntegerField(default=100, help_text="Lower numbers appear first.")
    is_system = models.BooleanField(
        default=False,
        help_text="Reserved slug; cannot be deleted. May be auto-applied from platform rules.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "common_userbadgedefinition"
        ordering = ["priority", "slug"]

    def __str__(self) -> str:
        return self.label
