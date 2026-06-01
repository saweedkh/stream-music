"""Channel API — ChannelJoinView."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.views import APIView

from apps.channels.helpers import (
    perform_channel_join,
)
from apps.channels.models import Channel


class ChannelJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        return perform_channel_join(request.user, channel, request.data.get("token"))
