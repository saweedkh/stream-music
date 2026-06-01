from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import Channel, ChannelMembership
from apps.social.models import ChannelFollow


class ChannelFollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if (
            not is_platform_superuser(request.user)
            and channel.privacy != Channel.Privacy.PUBLIC
            and not ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row = ChannelFollow.objects.filter(channel_id=channel_id, user_id=request.user.id).first()
        follower_count = ChannelFollow.objects.filter(channel_id=channel_id).count()
        return Response(
            {
                "following": row is not None,
                "notify_live": row.notify_live if row else True,
                "follower_count": follower_count,
            }
        )

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.privacy != Channel.Privacy.PUBLIC:
            return Response({"detail": "only_public_channels"}, status=status.HTTP_400_BAD_REQUEST)
        notify = request.data.get("notify_live", True)
        row, created = ChannelFollow.objects.get_or_create(
            channel_id=channel_id,
            user_id=request.user.id,
            defaults={"notify_live": bool(notify)},
        )
        if not created and "notify_live" in request.data:
            row.notify_live = bool(request.data.get("notify_live"))
            row.save(update_fields=["notify_live"])
        return Response({"following": True, "notify_live": row.notify_live}, status=status.HTTP_201_CREATED)

    def delete(self, request, channel_id: int):
        ChannelFollow.objects.filter(channel_id=channel_id, user_id=request.user.id).delete()
        return Response({"following": False})
