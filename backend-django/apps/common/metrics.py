"""Lightweight application metrics for monitoring."""

from __future__ import annotations

import time

from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelMembership
from apps.playback.models import PlaybackSession
from apps.tracks.models import Track


class MetricsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        active_channels = Channel.objects.filter(is_active=True).count()
        playing = PlaybackSession.objects.filter(is_playing=True).count()
        members_online = ChannelMembership.objects.filter(is_active=True).count()
        tracks = Track.objects.count()
        users = User.objects.filter(is_active=True).count()
        return Response(
            {
                "server_time": time.time(),
                "channels_active": active_channels,
                "channels_playing": playing,
                "memberships_active": members_online,
                "tracks_total": tracks,
                "users_active": users,
            }
        )
