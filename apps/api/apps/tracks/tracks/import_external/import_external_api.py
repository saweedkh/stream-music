"""Import audio from an external music URL into the user's library."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tracks.tracks.track_serializers import TrackSerializer
from apps.tracks.services.external_audio_import import ExternalImportError, import_track_from_url
from apps.tracks.tasks import import_external_track_task


class TrackImportExternalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        url = str(request.data.get("url") or "").strip()
        async_mode = bool(request.data.get("async"))
        if not url:
            return Response({"detail": "url_required"}, status=status.HTTP_400_BAD_REQUEST)
        if async_mode:
            import_external_track_task.delay(request.user.id, url)
            return Response({"ok": True, "status": "queued"}, status=status.HTTP_202_ACCEPTED)
        try:
            track = import_track_from_url(request.user.id, url)
        except ExternalImportError as exc:
            return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response(TrackSerializer(track, context={"request": request}).data, status=status.HTTP_201_CREATED)
