from rest_framework import serializers
from django.contrib.auth.models import User

from apps.channels.models import Channel, ChannelJoinRequest, ChannelMembership, InviteToken
from apps.playback.models import PlaybackSession
from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.models import Track, TrackSharePermission


class TrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Track
        fields = ["id", "title", "artist", "album", "duration_seconds", "file", "visibility", "created_at"]


class TrackSharePermissionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True)

    class Meta:
        model = TrackSharePermission
        fields = ["id", "track", "user", "channel", "username", "channel_name", "created_at"]


class ChannelSerializer(serializers.ModelSerializer):
    membership_is_active = serializers.SerializerMethodField()

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
            "is_playing",
            "started_at",
            "paused_at",
            "is_active",
            "membership_is_active",
        ]
        read_only_fields = ["owner", "public_slug", "is_playing", "started_at", "paused_at", "is_active", "membership_is_active"]

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
