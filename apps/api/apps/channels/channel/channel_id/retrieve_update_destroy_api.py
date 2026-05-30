"""Channel retrieve, update, and delete."""

from __future__ import annotations

from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import Channel
from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import ChannelSerializer
from apps.playback.services.state_store import playback_state_store


class ChannelRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "channel_id"

    def get_queryset(self):
        user = self.request.user
        qs = Channel.objects.select_related("owner").all()
        if is_platform_superuser(user):
            return qs.select_related("playback_session").distinct()
        return (
            qs.filter(memberships__user=user)
            .filter(Q(is_active=True) | Q(owner=user))
            .select_related("playback_session")
            .distinct()
        )

    def perform_update(self, serializer):
        channel = self.get_object()
        if not can_manage_channel(self.request.user, channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("only_channel_owner_can_delete_channel")
        playback_state_store.clear_channel(instance.id)
        instance.delete()
