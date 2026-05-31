"""Channel queue HTTP views."""

from rest_framework import permissions
from rest_framework.views import APIView

from apps.channels.services import channel_queue as queue_service


class ChannelQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        return queue_service.get_channel_queue(request.user, channel_id)


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


class ChannelQueueUpvoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, item_id: int):
        return queue_service.upvote_queue_item(request.user, channel_id, item_id)

    def delete(self, request, channel_id: int, item_id: int):
        return queue_service.remove_queue_upvote(request.user, channel_id, item_id)


class ChannelQueueJumpView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, item_id: int):
        return queue_service.jump_to_queue_item(request.user, channel_id, item_id)
