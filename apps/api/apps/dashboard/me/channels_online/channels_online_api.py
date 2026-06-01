"""Dashboard aggregation APIs."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dashboard.services import build_online_channels_payload


class MeChannelsOnlineView(APIView):
    """Online listeners across channels the user owns or is an active member of."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_online_channels_payload(request.user, request))
