"""Configurable user badges (admin-defined + reserved system slugs)."""

from __future__ import annotations

from django.conf import settings
from django.db import models

# Reserved slugs — auto-applied from platform flags or future billing.
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
        ordering = ["priority", "slug"]

    def __str__(self) -> str:
        return self.label


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
        unique_together = ("user", "badge")
        indexes = [models.Index(fields=["user", "badge"])]
