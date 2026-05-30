"""Channel list and create."""

from __future__ import annotations

from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import Channel, ChannelMembership, InviteToken
from apps.channels.serializers.channel_serializers import ChannelSerializer
from apps.playback.models import PlaybackSession


class ChannelListCreateView(generics.ListCreateAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Channel.objects.select_related("owner").all()
        if is_platform_superuser(user):
            qs = qs.select_related("playback_session").distinct()
        else:
            qs = (
                qs.filter(memberships__user=user)
                .filter(Q(is_active=True) | Q(owner=user))
                .select_related("playback_session")
                .distinct()
            )
        if self.request.method == "GET" and (
            self.request.query_params.get("include_test") or ""
        ).strip().lower() not in ("1", "true", "yes"):
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
