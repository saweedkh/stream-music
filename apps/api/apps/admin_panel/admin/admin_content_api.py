"""Admin browse/moderate tracks and playlists."""

from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_panel.admin.admin_api import SuperuserRequired
from apps.playlists.models import Playlist
from apps.tracks.models import Track


def _paginate(request, qs, *, default_limit: int = 50):
    try:
        limit = max(1, min(int(request.query_params.get("limit", str(default_limit))), 200))
    except (TypeError, ValueError):
        limit = default_limit
    try:
        offset = max(0, int(request.query_params.get("offset", "0")))
    except (TypeError, ValueError):
        offset = 0
    total = qs.count()
    return qs[offset : offset + limit], total, offset, limit


class AdminTracksView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = Track.objects.select_related("owner").order_by("-created_at")
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(artist__icontains=search)
                | Q(owner__username__icontains=search)
                | Q(import_source__icontains=search)
            )
        rows, total, offset, limit = _paginate(request, qs)
        results = [
            {
                "id": t.id,
                "title": t.title,
                "artist": t.artist,
                "owner_id": t.owner_id,
                "owner_username": t.owner.username if t.owner_id else None,
                "visibility": t.visibility,
                "import_source": t.import_source or "",
                "source_url": t.source_url or "",
                "duration_seconds": t.duration_seconds,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in rows
        ]
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminTrackDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def delete(self, request, track_id: int):
        track = Track.objects.filter(pk=track_id).first()
        if track is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        track.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminPlaylistsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = (
            Playlist.objects.select_related("owner")
            .annotate(track_count=Count("items"))
            .order_by("-created_at")
        )
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(owner__username__icontains=search))
        rows, total, offset, limit = _paginate(request, qs)
        results = [
            {
                "id": p.id,
                "name": p.name,
                "owner_id": p.owner_id,
                "owner_username": p.owner.username if p.owner_id else None,
                "is_auto_generated": p.is_auto_generated,
                "channel_id": p.channel_id,
                "track_count": p.track_count,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in rows
        ]
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminPlaylistDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def delete(self, request, playlist_id: int):
        playlist = Playlist.objects.filter(pk=playlist_id).first()
        if playlist is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        playlist.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
