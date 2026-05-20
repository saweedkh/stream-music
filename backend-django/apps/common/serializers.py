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
from apps.playlists.models import ChannelQueueItem, ChannelQueueUpvote, Playlist, PlaylistItem
from apps.tracks.models import Track, TrackSharePermission


class TrackSerializer(serializers.ModelSerializer):
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = [
            "id",
            "title",
            "artist",
            "album",
            "genre",
            "tags",
            "duration_seconds",
            "file",
            "visibility",
            "created_at",
            "is_favorited",
        ]

    def get_is_favorited(self, obj):
        fav_ids = self.context.get("favorited_track_ids")
        if fav_ids is not None:
            return obj.id in fav_ids
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_authenticated", False):
            return False
        from apps.common.favorites import UserTrackFavorite

        return UserTrackFavorite.objects.filter(user_id=request.user.id, track_id=obj.id).exists()


class TrackSharePermissionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True)

    class Meta:
        model = TrackSharePermission
        fields = ["id", "track", "user", "channel", "username", "channel_name", "created_at"]


class ChannelSerializer(serializers.ModelSerializer):
    membership_is_active = serializers.SerializerMethodField()
    brand_logo_url = serializers.SerializerMethodField()
    is_playing = serializers.SerializerMethodField()

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

    def get_is_playing(self, obj):
        session = getattr(obj, "playback_session", None)
        if session is None:
            return False
        return bool(session.is_playing)

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
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = Playlist
        fields = ["id", "name", "owner", "channel", "is_auto_generated", "created_at", "is_favorited"]
        read_only_fields = ["owner", "is_auto_generated", "created_at"]

    def get_is_favorited(self, obj):
        fav_ids = self.context.get("favorited_playlist_ids")
        if fav_ids is not None:
            return obj.id in fav_ids
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_authenticated", False):
            return False
        from apps.common.favorites import UserPlaylistFavorite

        return UserPlaylistFavorite.objects.filter(user_id=request.user.id, playlist_id=obj.id).exists()


class PlaylistItemSerializer(serializers.ModelSerializer):
    track_detail = TrackSerializer(source="track", read_only=True)

    class Meta:
        model = PlaylistItem
        fields = ["id", "playlist", "track", "track_detail", "position", "added_at"]


class QueueItemSerializer(serializers.ModelSerializer):
    upvote_count = serializers.SerializerMethodField()
    user_upvoted = serializers.SerializerMethodField()
    added_by_username = serializers.SerializerMethodField()

    class Meta:
        model = ChannelQueueItem
        fields = [
            "id",
            "channel",
            "track",
            "position",
            "added_by",
            "added_by_username",
            "created_at",
            "upvote_count",
            "user_upvoted",
        ]

    def get_upvote_count(self, obj):
        counts = self.context.get("upvote_counts") or {}
        return int(counts.get(obj.id, 0))

    def get_user_upvoted(self, obj):
        voted = self.context.get("user_upvoted_ids") or set()
        return obj.id in voted

    def get_added_by_username(self, obj):
        if not obj.added_by_id:
            return None
        names = self.context.get("added_by_names") or {}
        if obj.added_by_id in names:
            return names[obj.added_by_id]
        user = getattr(obj, "added_by", None)
        return getattr(user, "username", None) if user else None


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
        fields = [
            "chat_notify",
            "admin_notify_reactions",
            "admin_notify_votes",
            "push_quiet_hours_start",
            "push_quiet_hours_end",
            "push_category_playback",
            "push_category_chat",
            "push_category_moderation",
            "updated_at",
        ]
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
    date_joined = serializers.DateTimeField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)
    badges = serializers.SerializerMethodField()
    is_premium = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    is_public = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "is_premium",
            "badges",
            "date_joined",
            "bio",
            "is_public",
        ]

    def _public_profile(self, obj):
        from apps.common.social_models import UserPublicProfile

        return UserPublicProfile.objects.filter(user_id=obj.id).first()

    def get_bio(self, obj):
        row = self._public_profile(obj)
        return row.bio if row else ""

    def get_is_public(self, obj):
        row = self._public_profile(obj)
        return bool(row.is_public) if row else False

    def get_badges(self, obj):
        from apps.common.user_badges import badges_for_user

        return badges_for_user(obj)

    def get_is_premium(self, obj):
        from apps.common.account_badges import SLUG_PREMIUM
        from apps.common.user_badges import badges_for_user

        slugs = {b["slug"] for b in badges_for_user(obj)}
        return SLUG_PREMIUM in slugs


class AuthUserProfileUpdateSerializer(serializers.ModelSerializer):
    """Partial update for the signed-in user (username is immutable here)."""

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name"]


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)


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
