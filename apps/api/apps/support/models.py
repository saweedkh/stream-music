"""Support domain ORM models."""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class SupportTicket(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In progress"
        WAITING_USER = "waiting_user", "Waiting for user"
        WAITING_STAFF = "waiting_staff", "Waiting for staff"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Category(models.TextChoices):
        GENERAL = "general", "General"
        ACCOUNT = "account", "Account"
        BILLING = "billing", "Billing"
        TECHNICAL = "technical", "Technical"
        FEATURE = "feature", "Feature request"
        OTHER = "other", "Other"

    reference = models.CharField(max_length=32, unique=True, db_index=True)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets",
    )
    subject = models.CharField(max_length=200)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.GENERAL)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.OPEN, db_index=True)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.NORMAL, db_index=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_assigned_tickets",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_message_preview = models.CharField(max_length=280, blank=True, default="")

    class Meta:
        db_table = "common_supportticket"
        ordering = ["-last_message_at", "-updated_at", "-id"]
        indexes = [
            models.Index(fields=["requester", "-last_message_at"], name="common_supp_request_idx"),
            models.Index(fields=["status", "-last_message_at"], name="common_supp_status_idx"),
            models.Index(fields=["assigned_to", "-last_message_at"], name="common_supp_assign_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.reference}: {self.subject}"

    def save(self, *args, **kwargs):
        creating = self._state.adding
        if creating and not self.reference:
            self.reference = "TK-PENDING"
        super().save(*args, **kwargs)
        if creating and self.reference == "TK-PENDING":
            ts = self.created_at or timezone.now()
            self.reference = f"TK-{ts:%Y%m%d}-{self.pk:05d}"
            super().save(update_fields=["reference"])


class SupportMessage(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_messages")
    body = models.TextField()
    is_internal = models.BooleanField(default=False, help_text="Visible to support staff only.")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "common_supportmessage"
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["ticket", "created_at"], name="common_supp_msg_ticket_idx")]

    def __str__(self) -> str:
        return f"#{self.ticket_id} msg {self.id}"


class SupportTicketRead(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="read_states")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_reads")
    last_read_message_id = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "common_supportticketread"
        unique_together = ("ticket", "user")
