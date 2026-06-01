"""User points, level, and chart data."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.services.gamification import build_gamification_payload


class MeGamificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_gamification_payload(request.user.id))
