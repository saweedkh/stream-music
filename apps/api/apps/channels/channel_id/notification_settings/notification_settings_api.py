"""Channel API — ChannelNotificationPreferenceView."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import (
    ChannelMembership,
    ChannelNotificationPreference,
)
from apps.channels.serializers.channel_serializers import (
    ChannelNotificationPreferenceSerializer,
)


class ChannelNotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=request.user.id)
        return Response(ChannelNotificationPreferenceSerializer(row).data)

    def patch(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=request.user.id)
        for field in [
            "muted",
            "notify_room_started",
            "notify_queue_turn",
            "notify_skip_threshold",
            "notify_moderation",
        ]:
            if field in request.data:
                setattr(row, field, bool(request.data.get(field)))
        row.save()
        return Response(ChannelNotificationPreferenceSerializer(row).data)
