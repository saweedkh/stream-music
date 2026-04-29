from django.urls import path

from apps.playback.consumers import ChannelPlaybackConsumer

websocket_urlpatterns = [
    path("ws/channels/<int:channel_id>", ChannelPlaybackConsumer.as_asgi()),
]
