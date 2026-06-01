"""Channel API — ChannelMembersView."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser, user_badge_flags
from apps.channels.models import (
    ChannelMembership,
)
from apps.channels.permissions import can_manage_channel


class ChannelMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not can_manage_channel(request.user, channel_id)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        members = list(
            ChannelMembership.objects.filter(channel_id=channel_id).select_related("user").order_by("joined_at")
        )
        from apps.social.services.avatar import avatar_urls_for_user_ids

        avatars = avatar_urls_for_user_ids([m.user_id for m in members])
        data = [
            {
                "id": m.id,
                "user_id": m.user_id,
                "username": m.user.username,
                "role": m.role,
                "is_active": m.is_active,
                "joined_at": m.joined_at,
                "avatar_url": avatars.get(m.user_id),
                **user_badge_flags(m.user),
            }
            for m in members
        ]
        return Response({"results": data})
