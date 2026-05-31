from rest_framework import serializers

from apps.channels.models import (
    Channel,
    ChannelAuditLog,
    ChannelChatMessage,
    ChannelJoinRequest,
    ChannelMembership,
    ChannelNotificationPreference,
    ChannelPlaylistSuggestion,
    ChannelTrackReaction,
    InviteToken,
)
from apps.channels.services.brand_media import brand_logo_url_for

class ChannelSerializer(serializers.ModelSerializer):
    membership_is_active = serializers.SerializerMethodField()
    brand_logo_url = serializers.SerializerMethodField()
    is_playing = serializers.SerializerMethodField()
    owner_username = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = [
            "id",
            "name",
            "description",
            "owner",
            "owner_username",
            "privacy",
            "member_limit",
            "join_requires_approval",
            "public_slug",
            "public_join_slug",
            "is_playing",
            "started_at",
            "paused_at",
            "is_active",
            "membership_is_active",
            "experience",
            "brand_logo_url",
        ]
        read_only_fields = [
            "owner",
            "public_slug",
            "public_join_slug",
            "is_playing",
            "started_at",
            "paused_at",
            "is_active",
            "membership_is_active",
            "experience",
            "brand_logo_url",
        ]

    def get_brand_logo_url(self, obj):
        return brand_logo_url_for(obj)

    def get_is_playing(self, obj):
        session = getattr(obj, "playback_session", None)
        if session is None:
            return False
        return bool(session.is_playing)

    def get_owner_username(self, obj):
        owner = getattr(obj, "owner", None)
        return getattr(owner, "username", None) if owner else None

    def get_membership_is_active(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_authenticated", False):
            return None
        row = ChannelMembership.objects.filter(channel=obj, user=request.user).first()
        return row.is_active if row else None


class MembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChannelMembership
        fields = ["id", "channel", "user", "role", "is_active", "joined_at"]


class ChannelChatMessageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    pinned_by_username = serializers.CharField(source="pinned_by.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = ChannelChatMessage
        fields = [
            "id",
            "channel",
            "user_id",
            "username",
            "avatar_url",
            "body",
            "is_pinned",
            "pinned_at",
            "pinned_by_username",
            "created_at",
            "edited_at",
            "deleted_at",
            "reactions",
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj):
        cache = self.context.get("avatar_urls")
        if cache is not None:
            return cache.get(obj.user_id)
        from apps.social.services.avatar import avatar_url_for_user_id

        return avatar_url_for_user_id(obj.user_id)

    def get_reactions(self, obj):
        cache = getattr(obj, "_prefetched_objects_cache", {})
        rows = cache.get("reactions")
        if rows is not None:
            return [{"user_id": r.user_id, "username": r.user.username, "emoji": r.emoji} for r in rows]
        return [
            {"user_id": r.user_id, "username": r.user.username, "emoji": r.emoji}
            for r in obj.reactions.select_related("user").all()
        ]

class ChannelNotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChannelNotificationPreference
        fields = [
            "muted",
            "notify_room_started",
            "notify_queue_turn",
            "notify_skip_threshold",
            "notify_moderation",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
class InviteTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = InviteToken
        fields = ["id", "token", "max_uses", "used_count", "expires_at", "is_active", "created_at"]


class ChannelJoinRequestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ChannelJoinRequest
        fields = ["id", "channel", "user", "username", "status", "created_at", "resolved_at", "resolved_by"]
        read_only_fields = ["channel", "user", "status", "created_at", "resolved_at", "resolved_by"]


class ChannelTrackReactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ChannelTrackReaction
        fields = ["id", "channel", "track", "user", "username", "emoji", "created_at"]
        read_only_fields = ["id", "channel", "track", "user", "username", "created_at"]


class ChannelAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = ChannelAuditLog
        fields = ["id", "channel", "actor", "actor_username", "action", "target_type", "target_id", "metadata", "created_at"]
        read_only_fields = fields

class ChannelPlaylistSuggestionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    track_title = serializers.SerializerMethodField()

    class Meta:
        model = ChannelPlaylistSuggestion
        fields = [
            "id",
            "channel",
            "track",
            "track_title",
            "external_url",
            "external_title",
            "external_artist",
            "external_source",
            "user",
            "username",
            "status",
            "note",
            "created_at",
            "reviewed_at",
            "reviewed_by",
        ]
        read_only_fields = ["id", "channel", "track_title", "username", "created_at", "reviewed_at", "reviewed_by"]

    def get_track_title(self, obj):
        if obj.track_id and getattr(obj, "track", None):
            return obj.track.title
        if obj.external_title:
            return obj.external_title
        return None
