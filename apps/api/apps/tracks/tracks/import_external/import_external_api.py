"""Import audio from an external music URL into the user's library."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tracks.services.external_audio_import import ExternalImportError, validate_music_url
from apps.tracks.tasks import import_streaming_track_task


class TrackImportExternalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        url = str(request.data.get("url") or "").strip()
        if not url:
            return Response({"detail": "url_required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_music_url(url)
        except ExternalImportError as exc:
            return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        async_result = import_streaming_track_task.delay(request.user.id, url)
        return Response(
            {"status": "pending", "task_id": async_result.id},
            status=status.HTTP_202_ACCEPTED,
        )
