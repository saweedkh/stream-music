"""Channel API — ChannelQueueItemManageView."""

from rest_framework import permissions
from rest_framework.views import APIView

from apps.channels.services import channel_queue as queue_service


class ChannelQueueItemManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, channel_id: int, item_id: int):
        return queue_service.reorder_queue_item(
            request.user,
            channel_id,
            item_id,
            request.data.get("position", 0),
        )

    def delete(self, request, channel_id: int, item_id: int):
        return queue_service.delete_queue_item(request.user, channel_id, item_id)
