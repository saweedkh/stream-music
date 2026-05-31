"""Activity feed for followed users."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.social.services.activity_feed import build_activity_feed


class ActivityFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_activity_feed(request.user))
