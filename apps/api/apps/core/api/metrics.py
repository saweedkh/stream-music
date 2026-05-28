"""Lightweight application metrics for monitoring."""

from __future__ import annotations

import time

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelJoinRequest, ChannelMembership, ChannelPlaylistSuggestion, WebPushSubscription
from apps.playback.models import PlaybackSession
from apps.playback.consumers import _presence_snapshot
from apps.tracks.models import Track


def _webpush_status() -> dict:
    pub = bool(getattr(settings, "WEBPUSH_VAPID_PUBLIC_KEY", ""))
    priv = bool(getattr(settings, "WEBPUSH_VAPID_PRIVATE_KEY", ""))
    try:
        import pywebpush  # noqa: F401

        pywebpush_ok = True
    except ImportError:
        pywebpush_ok = False
    configured = pub and priv and pywebpush_ok
    return {
        "vapid_public_set": pub,
        "vapid_private_set": priv,
        "pywebpush_installed": pywebpush_ok,
        "ready": configured,
        "subscriptions": WebPushSubscription.objects.count(),
    }


class MetricsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        active_channels = Channel.objects.filter(is_active=True).count()
        playing = PlaybackSession.objects.filter(is_playing=True).count()
        members_online = ChannelMembership.objects.filter(is_active=True).count()
        tracks = Track.objects.count()
        users = User.objects.filter(is_active=True).count()
        webpush = _webpush_status()
        presence_channels = 0
        presence_listeners = 0
        for ch_id in Channel.objects.filter(is_active=True).values_list("id", flat=True)[:200]:
            _, n = _presence_snapshot(int(ch_id))
            if n > 0:
                presence_channels += 1
                presence_listeners += n
        pending_suggestions = ChannelPlaylistSuggestion.objects.filter(
            status=ChannelPlaylistSuggestion.Status.PENDING,
        ).count()
        pending_join_requests = ChannelJoinRequest.objects.filter(status=ChannelJoinRequest.Status.PENDING).count()
        return Response(
            {
                "server_time": time.time(),
                "channels_active": active_channels,
                "channels_playing": playing,
                "memberships_active": members_online,
                "tracks_total": tracks,
                "users_active": users,
                "webpush": webpush,
                "realtime": {
                    "channels_with_presence": presence_channels,
                    "listeners_in_presence": presence_listeners,
                },
                "pending_suggestions": pending_suggestions,
                "pending_join_requests": pending_join_requests,
            }
        )
