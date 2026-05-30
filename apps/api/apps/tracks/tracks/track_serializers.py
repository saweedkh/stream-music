from rest_framework import serializers

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
        from apps.accounts.models import UserTrackFavorite

        return UserTrackFavorite.objects.filter(user_id=request.user.id, track_id=obj.id).exists()


class TrackSharePermissionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True)

    class Meta:
        model = TrackSharePermission
        fields = ["id", "track", "user", "channel", "username", "channel_name", "created_at"]
