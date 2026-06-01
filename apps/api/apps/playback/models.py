from django.conf import settings
from django.db import models

from apps.channels.models import Channel
from apps.tracks.models import Track


class PlaybackSession(models.Model):
    channel = models.OneToOneField(Channel, on_delete=models.CASCADE, related_name="playback_session")
    track = models.ForeignKey(Track, on_delete=models.SET_NULL, null=True, blank=True)
    started_at_server_time = models.FloatField(null=True, blank=True)
    paused_at_position = models.FloatField(null=True, blank=True)
    is_playing = models.BooleanField(default=False)
    playback_rate = models.FloatField(default=1.0)
    queue_version = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)


class PlaybackEvent(models.Model):
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="playback_events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="playback_events"
    )
    track = models.ForeignKey(Track, on_delete=models.SET_NULL, null=True, blank=True, related_name="playback_events")
    event_type = models.CharField(max_length=32)
    source = models.CharField(max_length=32, blank=True, default="manual")
    payload = models.JSONField(default=dict)
    emitted_at = models.DateTimeField(auto_now_add=True)
