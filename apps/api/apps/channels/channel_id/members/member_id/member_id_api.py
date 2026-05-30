"""Channel API — ChannelMemberManageView."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.helpers import (
    _log_channel_audit,
)
from apps.channels.models import (
    ChannelMembership,
)
from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import (
    MembershipSerializer,
)


class ChannelMemberManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, channel_id: int, member_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(ChannelMembership, id=member_id, channel_id=channel_id)
        role = request.data.get("role")
        if role not in [ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR, ChannelMembership.Role.MEMBER]:
            return Response({"detail": "invalid_role"}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == ChannelMembership.Role.OWNER and role != ChannelMembership.Role.OWNER:
            current_owners = ChannelMembership.objects.filter(
                channel_id=channel_id, role=ChannelMembership.Role.OWNER, is_active=True
            ).count()
            if current_owners <= 1:
                return Response({"detail": "owner_must_be_unique"}, status=status.HTTP_400_BAD_REQUEST)
        if role == ChannelMembership.Role.OWNER:
            ChannelMembership.objects.filter(channel_id=channel_id, role=ChannelMembership.Role.OWNER).exclude(
                id=membership.id
            ).update(role=ChannelMembership.Role.MODERATOR)
            channel = membership.channel
            channel.owner_id = membership.user_id
            channel.save(update_fields=["owner", "updated_at"])
        membership.role = role
        membership.save(update_fields=["role"])
        _log_channel_audit(
            channel_id,
            "membership.role_changed",
            request.user.id,
            target_type="membership",
            target_id=membership.id,
            metadata={"role": role},
        )
        return Response(MembershipSerializer(membership).data)

    def delete(self, request, channel_id: int, member_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(ChannelMembership, id=member_id, channel_id=channel_id)
        if membership.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "cannot_remove_owner"}, status=status.HTTP_400_BAD_REQUEST)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        _log_channel_audit(
            channel_id, "membership.removed", request.user.id, target_type="membership", target_id=membership.id
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
