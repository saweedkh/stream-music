from rest_framework import serializers

from apps.playback.models import PlaybackEvent, PlaybackSession
from apps.tracks.api.serializers import TrackSerializer

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

