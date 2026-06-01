"""Channel API — ChannelQueueUpvoteView."""

from rest_framework import permissions
from rest_framework.views import APIView

from apps.channels.services import channel_queue as queue_service


class ChannelQueueUpvoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, item_id: int):
        return queue_service.upvote_queue_item(request.user, channel_id, item_id)

    def delete(self, request, channel_id: int, item_id: int):
        return queue_service.remove_queue_upvote(request.user, channel_id, item_id)
