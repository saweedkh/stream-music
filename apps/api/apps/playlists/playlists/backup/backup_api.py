"""Export user playlists as JSON backup."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.playlists.services.backup_export import build_playlist_backup_payload


class PlaylistBackupExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payload = build_playlist_backup_payload(request.user)
        return Response(payload)
