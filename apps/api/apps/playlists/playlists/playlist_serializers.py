from rest_framework import serializers

from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.tracks.track_serializers import TrackSerializer


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
        from apps.accounts.models import UserPlaylistFavorite

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
    track_owner_premium = serializers.SerializerMethodField()
    premium_boosted = serializers.SerializerMethodField()

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
            "track_owner_premium",
            "premium_boosted",
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

    def get_track_owner_premium(self, obj):
        premium_ids = self.context.get("premium_track_ids") or set()
        return obj.track_id in premium_ids if obj.track_id else False

    def get_premium_boosted(self, obj):
        boosted_ids = self.context.get("premium_boosted_ids") or set()
        return obj.id in boosted_ids
