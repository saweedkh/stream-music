"""Admin browse/moderate tracks and playlists."""

from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_panel.admin.permissions import SuperuserRequired
from apps.admin_panel.admin.audit_helpers import log_admin_action
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


def pagination_params(request, *, default_limit: int = 50) -> tuple[int, int]:
    try:
        limit = max(1, min(int(request.query_params.get("limit", str(default_limit))), 200))
    except (TypeError, ValueError):
        limit = default_limit
    try:
        offset = max(0, int(request.query_params.get("offset", "0")))
    except (TypeError, ValueError):
        offset = 0
    return offset, limit


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

    def get(self, request, track_id: int):
        track = Track.objects.select_related("owner").filter(pk=track_id).first()
        if track is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "id": track.id,
                "title": track.title,
                "artist": track.artist,
                "owner_id": track.owner_id,
                "owner_username": track.owner.username if track.owner_id else None,
                "visibility": track.visibility,
                "import_source": track.import_source or "",
                "source_url": track.source_url or "",
                "duration_seconds": track.duration_seconds,
                "created_at": track.created_at.isoformat() if track.created_at else None,
            }
        )

    def patch(self, request, track_id: int):
        track = Track.objects.filter(pk=track_id).first()
        if track is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        update_fields: list[str] = []
        if "visibility" in request.data:
            visibility = str(request.data["visibility"])
            if visibility in Track.Visibility.values:
                track.visibility = visibility
                update_fields.append("visibility")
        if "title" in request.data:
            title = str(request.data["title"]).strip()
            if title:
                track.title = title[:255]
                update_fields.append("title")
        if "artist" in request.data:
            track.artist = str(request.data["artist"]).strip()[:255]
            update_fields.append("artist")
        if update_fields:
            track.save(update_fields=update_fields)
            log_admin_action(request, "track.update", "track", track.id, {"fields": update_fields})
        return Response(
            {
                "id": track.id,
                "title": track.title,
                "artist": track.artist,
                "visibility": track.visibility,
            }
        )

    def delete(self, request, track_id: int):
        track = Track.objects.filter(pk=track_id).first()
        if track is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        title = track.title
        track.delete()
        log_admin_action(request, "track.delete", "track", track_id, {"title": title})
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

    def patch(self, request, playlist_id: int):
        playlist = Playlist.objects.filter(pk=playlist_id).first()
        if playlist is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if "name" in request.data:
            name = str(request.data["name"]).strip()
            if name:
                playlist.name = name[:255]
                playlist.save(update_fields=["name"])
                log_admin_action(request, "playlist.update", "playlist", playlist.id, {"name": playlist.name})
        return Response({"id": playlist.id, "name": playlist.name})

    def delete(self, request, playlist_id: int):
        playlist = Playlist.objects.filter(pk=playlist_id).first()
        if playlist is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        name = playlist.name
        playlist.delete()
        log_admin_action(request, "playlist.delete", "playlist", playlist_id, {"name": name})
        return Response(status=status.HTTP_204_NO_CONTENT)
