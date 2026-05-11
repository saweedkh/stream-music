import uuid

from django.conf import settings
from django.db import models


class Channel(models.Model):
    class Privacy(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"
        UNLISTED = "unlisted", "Unlisted"

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_channels")
    privacy = models.CharField(max_length=16, choices=Privacy.choices, default=Privacy.PUBLIC)
    member_limit = models.PositiveIntegerField(default=50)
    join_requires_approval = models.BooleanField(default=False)
    public_slug = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    # Optional short code for /join/public/<code> when privacy is public or unlisted (letters + digits + hyphen).
    public_join_slug = models.CharField(max_length=40, null=True, blank=True, unique=True, db_index=True)
    current_track_id = models.BigIntegerField(null=True, blank=True)
    is_playing = models.BooleanField(default=False)
    started_at = models.FloatField(null=True, blank=True)
    paused_at = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # UI / "experience pack": accent, rehearsal_mode, queue_locked, blind_playlist_id, intro_preview_seconds, veto_skip_threshold, etc.
    experience = models.JSONField(default=dict, blank=True)
    brand_logo = models.ImageField(upload_to="channel_brand/", null=True, blank=True)


class ChannelMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        MODERATOR = "moderator", "Moderator"
        MEMBER = "member", "Member"

    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_memberships")
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.MEMBER)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("channel", "user")


class ChannelJoinRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="join_requests")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_join_requests")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    invite = models.ForeignKey("InviteToken", on_delete=models.SET_NULL, null=True, blank=True, related_name="join_requests")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_join_requests",
    )


class UserNotificationSettings(models.Model):
    """Per-user defaults for web push (browser)."""

    class ChatNotify(models.TextChoices):
        MUTED = "muted", "Muted"
        MENTIONS = "mentions", "Mentions only"
        ALL = "all", "All messages"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_settings",
    )
    chat_notify = models.CharField(max_length=16, choices=ChatNotify.choices, default=ChatNotify.ALL)
    admin_notify_reactions = models.BooleanField(default=True)
    admin_notify_votes = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"NotificationSettings({self.user_id})"


class WebPushSubscription(models.Model):
    """Browser push subscription (VAPID). One row per endpoint."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="webpush_subscriptions",
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "id"]),
        ]


class ChannelChatMessage(models.Model):
    """Text chat visible only to members of this channel (enforced in API / WS)."""

    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="chat_messages")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_chat_messages")
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["channel", "id"]),
        ]


class ChannelChatMessageReaction(models.Model):
    """One reaction emoji per user per message (change replaces previous)."""

    message = models.ForeignKey(ChannelChatMessage, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="channel_chat_reactions")
    emoji = models.CharField(max_length=16)

    class Meta:
        unique_together = ("message", "user")
        indexes = [
            models.Index(fields=["message", "id"]),
        ]


class InviteToken(models.Model):
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="invites")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    max_uses = models.PositiveIntegerField(default=0)
    used_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
