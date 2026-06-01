"""Channel API — ChannelCloseView."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.helpers import (
    _log_channel_audit,
)
from apps.channels.models import (
    Channel,
)
from apps.playback.services.state_store import playback_state_store


class ChannelCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.owner_id != request.user.id and not is_platform_superuser(request.user):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if not channel.is_active:
            return Response(status=status.HTTP_204_NO_CONTENT)
        channel.is_active = False
        channel.save(update_fields=["is_active", "updated_at"])
        playback_state_store.clear_channel(channel.id)
        _log_channel_audit(channel.id, "channel.closed", request.user.id, target_type="channel", target_id=channel.id)
        return Response(status=status.HTTP_204_NO_CONTENT)
