"""Import playlists from JSON backup."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.playlists.services.backup_import import BackupImportError, import_playlist_backup


class PlaylistBackupImportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not isinstance(request.data, dict):
            return Response({"detail": "invalid_payload"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = import_playlist_backup(request.user, request.data)
        except BackupImportError as exc:
            return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)
