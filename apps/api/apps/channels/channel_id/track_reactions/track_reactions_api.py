"""Channel API — ChannelTrackReactionView."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.helpers import (
    _log_channel_audit,
)
from apps.channels.models import (
    ChannelMembership,
    ChannelTrackReaction,
)
from apps.channels.serializers.channel_serializers import (
    ChannelTrackReactionSerializer,
)


class ChannelTrackReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        track_id = request.query_params.get("track_id")
        qs = ChannelTrackReaction.objects.filter(channel_id=channel_id).select_related("user")
        if track_id:
            qs = qs.filter(track_id=track_id)
        rows = qs.order_by("-id")[:250]
        return Response({"results": ChannelTrackReactionSerializer(rows, many=True).data})

    def post(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        track_id = request.data.get("track_id")
        emoji = str(request.data.get("emoji") or "").strip()[:16]
        if not track_id or not emoji:
            return Response({"detail": "track_id_and_emoji_required"}, status=status.HTTP_400_BAD_REQUEST)
        row, _ = ChannelTrackReaction.objects.get_or_create(
            channel_id=channel_id,
            track_id=int(track_id),
            user_id=request.user.id,
            emoji=emoji,
        )
        _log_channel_audit(
            channel_id,
            "track.react",
            request.user.id,
            target_type="track",
            target_id=track_id,
            metadata={"emoji": emoji},
        )
        return Response(ChannelTrackReactionSerializer(row).data, status=status.HTTP_201_CREATED)
