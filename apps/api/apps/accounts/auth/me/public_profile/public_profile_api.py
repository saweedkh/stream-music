"""Public user profiles."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services import get_public_profile_by_username, update_me_public_profile


class PublicUserProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username: str):
        viewer = request.user if getattr(request.user, "is_authenticated", False) else None
        payload, err, http_status = get_public_profile_by_username(username, viewer, request)
        if err:
            return Response({"detail": err}, status=http_status or status.HTTP_404_NOT_FOUND)
        return Response(payload)


class MePublicProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def patch(self, request):
        try:
            payload = update_me_public_profile(request.user, request.data, request=request)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)
