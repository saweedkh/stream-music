"""Channel API — ChannelQueueView."""

from rest_framework import permissions
from rest_framework.views import APIView

from apps.channels.services import channel_queue as queue_service


class ChannelQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        return queue_service.get_channel_queue(request.user, channel_id)
