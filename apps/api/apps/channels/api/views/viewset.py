from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.api.helpers import _can_manage_channel
from apps.channels.api.serializers import ChannelSerializer
from apps.channels.models import Channel, ChannelMembership, InviteToken
from apps.playback.models import PlaybackSession
from apps.playback.services.state_store import playback_state_store


class ChannelViewSet(viewsets.ModelViewSet):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Channel.objects.select_related("owner").all()

    def get_queryset(self):
        user = self.request.user
        if is_platform_superuser(user):
            qs = self.queryset.select_related("playback_session").distinct()
        else:
            qs = (
                self.queryset.filter(memberships__user=user)
                .filter(Q(is_active=True) | Q(owner=user))
                .select_related("playback_session")
                .distinct()
            )
        if getattr(self, "action", None) == "list" and not (
            self.request.query_params.get("include_test") or ""
        ).strip().lower() in ("1", "true", "yes"):
            qs = qs.exclude(Q(name__iexact="E2E") | Q(name__istartswith="E2E Room") | Q(name__istartswith="E2E "))
        return qs.order_by("-is_active", "-id")

    def create(self, request, *args, **kwargs):
        from apps.accounts.premium_limits import can_create_channel

        ok, code = can_create_channel(request.user)
        if not ok:
            return Response({"detail": code}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from apps.accounts.premium_limits import clamp_member_limit

        ml = clamp_member_limit(self.request.user, serializer.validated_data.get("member_limit", 50))
        channel = serializer.save(owner=self.request.user, member_limit=ml)
        ChannelMembership.objects.create(channel=channel, user=self.request.user, role=ChannelMembership.Role.OWNER)
        PlaybackSession.objects.get_or_create(channel=channel)
        InviteToken.objects.create(channel=channel, created_by=self.request.user, is_active=True)

    def _can_manage(self, channel_id: int) -> bool:
        return _can_manage_channel(self.request.user, channel_id)

    def perform_update(self, serializer):
        channel = self.get_object()
        if not self._can_manage(channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("only_channel_owner_can_delete_channel")
        playback_state_store.clear_channel(instance.id)
        instance.delete()
