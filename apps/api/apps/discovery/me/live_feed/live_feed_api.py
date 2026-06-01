"""Live channels from followed users and friends."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.discovery.services.live_feed import build_live_friends_feed


class MeLiveFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_live_friends_feed(request.user))
