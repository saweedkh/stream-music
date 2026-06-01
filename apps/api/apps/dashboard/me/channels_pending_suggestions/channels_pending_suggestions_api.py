"""Dashboard pending suggestions."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dashboard.services import build_pending_suggestions_payload


class MeChannelsPendingSuggestionsView(APIView):
    """Pending suggestion counts for channels the user can manage."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_pending_suggestions_payload(request.user))
