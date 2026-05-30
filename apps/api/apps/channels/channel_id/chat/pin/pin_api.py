"""Channel API — ChannelChatPinView."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.helpers import (
    _log_channel_audit,
)
from apps.channels.models import (
    ChannelChatMessage,
    ChannelMembership,
)
from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import (
    ChannelChatMessageSerializer,
)


class ChannelChatPinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        msg = (
            ChannelChatMessage.objects.filter(channel_id=channel_id, is_pinned=True)
            .select_related("user", "pinned_by")
            .prefetch_related("reactions__user")
            .order_by("-pinned_at", "-id")
            .first()
        )
        return Response(
            {"message": ChannelChatMessageSerializer(msg, context={"request": request}).data if msg else None}
        )

    def put(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        message_id = request.data.get("message_id")
        with transaction.atomic():
            ChannelChatMessage.objects.filter(channel_id=channel_id, is_pinned=True).update(
                is_pinned=False,
                pinned_at=None,
                pinned_by=None,
            )
            if message_id in (None, "", 0):
                _log_channel_audit(channel_id, "chat.unpin_all", request.user.id, target_type="chat_message")
                return Response({"message": None})
            msg = get_object_or_404(ChannelChatMessage, id=int(message_id), channel_id=channel_id)
            msg.is_pinned = True
            msg.pinned_at = timezone.now()
            msg.pinned_by = request.user
            msg.save(update_fields=["is_pinned", "pinned_at", "pinned_by"])
            _log_channel_audit(channel_id, "chat.pin", request.user.id, target_type="chat_message", target_id=msg.id)
        return Response({"message": ChannelChatMessageSerializer(msg, context={"request": request}).data})
