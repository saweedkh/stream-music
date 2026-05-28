from django.urls import path

from apps.channels.consumers import ChannelChatConsumer
from apps.support.consumers import SupportStaffInboxConsumer, SupportTicketConsumer
from apps.playback.consumers import ChannelPlaybackConsumer

websocket_urlpatterns = [
    path("ws/channels/<int:channel_id>/chat", ChannelChatConsumer.as_asgi()),
    path("ws/channels/<int:channel_id>", ChannelPlaybackConsumer.as_asgi()),
    path("ws/support/tickets/<int:ticket_id>", SupportTicketConsumer.as_asgi()),
    path("ws/support/inbox", SupportStaffInboxConsumer.as_asgi()),
]
