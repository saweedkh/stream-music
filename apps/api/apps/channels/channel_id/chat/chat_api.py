"""Channel API — ChannelChatView."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.helpers import (
    _channel_closed_response,
)
from apps.channels.models import (
    Channel,
    ChannelChatMessage,
    ChannelMembership,
)
from apps.channels.serializers.channel_serializers import (
    ChannelChatMessageSerializer,
)


class ChannelChatView(APIView):
    """Channel-scoped chat: only active members of this channel can read or post."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id:
            return _channel_closed_response()
        try:
            limit = int(request.query_params.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = min(100, max(1, limit))
        qs = (
            ChannelChatMessage.objects.filter(channel_id=channel_id)
            .select_related("user")
            .prefetch_related("reactions__user")
            .order_by("-id")
        )
        before = request.query_params.get("before")
        if before:
            try:
                bid = int(before)
                qs = qs.filter(id__lt=bid)
            except (TypeError, ValueError):
                pass
        rows = list(qs[:limit])
        rows.reverse()
        return Response({"results": ChannelChatMessageSerializer(rows, many=True, context={"request": request}).data})
