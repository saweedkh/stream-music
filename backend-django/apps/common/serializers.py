from rest_framework import serializers
from django.contrib.auth.models import User

from apps.channels.models import (
    Channel,
    ChannelAuditLog,
    ChannelChatMessage,
    ChannelNotificationPreference,
    ChannelPlaylistSuggestion,
    ChannelTrackReaction,
    ChannelJoinRequest,
    ChannelMembership,
    InviteToken,
    UserNotificationSettings,
)
from apps.playback.models import PlaybackEvent, PlaybackSession
from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.models import Track, TrackSharePermission


class TrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Track
        fields = ["id", "title", "artist", "album", "genre", "tags", "duration_seconds", "file", "visibility", "created_at"]


class TrackSharePermissionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True)

    class Meta:
        model = TrackSharePermission
        fields = ["id", "track", "user", "channel", "username", "channel_name", "created_at"]


class ChannelSerializer(serializers.ModelSerializer):
    membership_is_active = serializers.SerializerMethodField()
    brand_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = [
            "id",
            "name",
            "description",
            "owner",
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
        if not obj.brand_logo:
            return None
        request = self.context.get("request")
        url = obj.brand_logo.url
        if request:
            return request.build_absolute_uri(url)
        return url

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
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = ChannelChatMessage
        fields = [
            "id",
            "channel",
            "user_id",
            "username",
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

    def get_reactions(self, obj):
        cache = getattr(obj, "_prefetched_objects_cache", {})
        rows = cache.get("reactions")
        if rows is not None:
            return [{"user_id": r.user_id, "username": r.user.username, "emoji": r.emoji} for r in rows]
        return [
            {"user_id": r.user_id, "username": r.user.username, "emoji": r.emoji}
            for r in obj.reactions.select_related("user").all()
        ]


class PlaylistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playlist
        fields = ["id", "name", "owner", "channel", "is_auto_generated", "created_at"]
        read_only_fields = ["owner", "is_auto_generated", "created_at"]


class PlaylistItemSerializer(serializers.ModelSerializer):
    track_detail = TrackSerializer(source="track", read_only=True)

    class Meta:
        model = PlaylistItem
        fields = ["id", "playlist", "track", "track_detail", "position", "added_at"]


class QueueItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChannelQueueItem
        fields = ["id", "channel", "track", "position", "added_by", "created_at"]


class PlaybackSessionSerializer(serializers.ModelSerializer):
    track = TrackSerializer(read_only=True)

    class Meta:
        model = PlaybackSession
        fields = [
            "id",
            "channel",
            "track",
            "started_at_server_time",
            "paused_at_position",
            "is_playing",
            "playback_rate",
            "queue_version",
            "updated_at",
        ]


class UserNotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserNotificationSettings
        fields = ["chat_notify", "admin_notify_reactions", "admin_notify_votes", "updated_at"]
        read_only_fields = ["updated_at"]


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


class AuthUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff"]


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


class PlaybackEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    track_title = serializers.CharField(source="track.title", read_only=True)

    class Meta:
        model = PlaybackEvent
        fields = [
            "id",
            "channel",
            "actor",
            "actor_username",
            "track",
            "track_title",
            "event_type",
            "source",
            "payload",
            "emitted_at",
        ]
        read_only_fields = fields


class ChannelPlaylistSuggestionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    track_title = serializers.CharField(source="track.title", read_only=True)

    class Meta:
        model = ChannelPlaylistSuggestion
        fields = [
            "id",
            "channel",
            "track",
            "track_title",
            "user",
            "username",
            "status",
            "note",
            "created_at",
            "reviewed_at",
            "reviewed_by",
        ]
        read_only_fields = ["id", "channel", "track_title", "username", "created_at", "reviewed_at", "reviewed_by"]
