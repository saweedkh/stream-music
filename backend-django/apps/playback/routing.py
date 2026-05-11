from django.urls import path

from apps.channels.consumers import ChannelChatConsumer
from apps.playback.consumers import ChannelPlaybackConsumer

websocket_urlpatterns = [
    path("ws/channels/<int:channel_id>/chat", ChannelChatConsumer.as_asgi()),
    path("ws/channels/<int:channel_id>", ChannelPlaybackConsumer.as_asgi()),
]
