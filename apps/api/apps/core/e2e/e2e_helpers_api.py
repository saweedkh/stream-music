"""E2E-only helpers (disabled unless E2E_RATE_LIMIT_OFF)."""

from __future__ import annotations

from django.conf import settings
from django.core.files.base import ContentFile
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models.premium_invite_code import PremiumInviteCode
from apps.tracks.models import Track
from apps.tracks.tracks.track_serializers import TrackSerializer


class E2EPremiumCodeView(APIView):
    """Create a one-off premium invite code for Playwright UI tests."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not getattr(settings, "E2E_RATE_LIMIT_OFF", False):
            return Response({"detail": "not_available"}, status=status.HTTP_404_NOT_FOUND)
        row = PremiumInviteCode.objects.create(max_uses=50, note="e2e")
        return Response({"code": row.code})


class E2ETrackImportMockView(APIView):
    """Create a track as if imported from URL — no network/Celery (E2E only)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not getattr(settings, "E2E_RATE_LIMIT_OFF", False):
            return Response({"detail": "not_available"}, status=status.HTTP_404_NOT_FOUND)
        url = (request.data.get("url") or "https://e2e.example/track").strip()
        title = (request.data.get("title") or "E2E Import").strip()[:255]
        track = Track.objects.create(
            owner=request.user,
            title=title,
            visibility=Track.Visibility.PRIVATE,
            import_source="e2e",
            source_url=url[:500],
        )
        track.file.save("e2e-import.mp3", ContentFile(b"ID3\xe2e"), save=True)
        data = TrackSerializer(track, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)
