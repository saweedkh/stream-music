"""Export session queue to playlist."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel
from apps.channels.permissions import can_manage_channel
from apps.channels.services.party_recap import build_party_recap
from apps.playlists.models import Playlist, PlaylistItem
from apps.playlists.playlists.playlist_serializers import PlaylistSerializer
from apps.tracks.models import Track


class ChannelSessionExportPlaylistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        name = str(request.data.get("name") or f"{channel.name} session").strip()[:255]
        dest_channel = request.data.get("save_to_channel")
        playlist_channel_id = channel_id if dest_channel else None
        recap = build_party_recap(channel, limit=120)
        track_ids = []
        seen = set()
        for row in recap.get("top_tracks") or []:
            tid = row.get("id")
            if tid and tid not in seen:
                seen.add(tid)
                track_ids.append(tid)
        for row in reversed(recap.get("timeline") or []):
            tid = row.get("track_id")
            if tid and tid not in seen:
                seen.add(tid)
                track_ids.append(tid)
        if not track_ids:
            return Response({"detail": "no_tracks"}, status=status.HTTP_400_BAD_REQUEST)
        dest = Playlist.objects.create(name=name, owner=request.user, channel_id=playlist_channel_id)
        tracks = Track.objects.filter(id__in=track_ids)
        track_map = {t.id: t for t in tracks}
        for i, tid in enumerate(track_ids):
            t = track_map.get(tid)
            if t:
                PlaylistItem.objects.create(playlist=dest, track=t, position=i)
        return Response(
            {"playlist": PlaylistSerializer(dest, context={"request": request}).data}, status=status.HTTP_201_CREATED
        )
