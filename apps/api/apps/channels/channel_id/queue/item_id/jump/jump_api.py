"""Channel API — ChannelQueueJumpView."""

from rest_framework import permissions
from rest_framework.views import APIView

from apps.channels.services import channel_queue as queue_service


class ChannelQueueJumpView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, item_id: int):
        return queue_service.jump_to_queue_item(request.user, channel_id, item_id)
