"""Channel queue import from share and session export."""

from __future__ import annotations

import re

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel
from apps.common.party_recap import build_party_recap
from apps.common.serializers import PlaylistSerializer
from apps.common.social_models import PlaylistShareLink
from apps.common.views import _can_manage_channel, _serialize_queue
from apps.playback.models import PlaybackSession
from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.models import Track

_SPOTIFY_RE = re.compile(r"(?:open\.)?spotify\.com/(?:track|album|playlist)/", re.I)
_YOUTUBE_RE = re.compile(r"(?:youtube\.com/watch|youtu\.be/)", re.I)


def parse_external_source(url: str) -> tuple[str, str, str, str]:
    raw = (url or "").strip()
    if not raw:
        return "", "", "", ""
    source = ""
    if _SPOTIFY_RE.search(raw):
        source = "spotify"
    elif _YOUTUBE_RE.search(raw):
        source = "youtube"
    else:
        source = "link"
    title = str(raw).split("/")[-1].split("?")[0][:255] or "External link"
    return raw[:500], title, "", source


class ChannelQueueImportShareView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        token = (request.data.get("share_token") or "").strip()
        if not token:
            return Response({"detail": "share_token_required"}, status=status.HTTP_400_BAD_REQUEST)
        link = PlaylistShareLink.objects.filter(token=token, is_active=True).select_related("playlist").first()
        if not link:
            return Response({"detail": "invalid_share"}, status=status.HTTP_404_NOT_FOUND)
        if link.expires_at and link.expires_at < timezone.now():
            return Response({"detail": "share_expired"}, status=status.HTTP_410_GONE)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return Response({"detail": "channel_closed"}, status=status.HTTP_410_GONE)
        src_items = PlaylistItem.objects.filter(playlist=link.playlist).select_related("track").order_by("position", "id")
        tracks = [item.track for item in src_items if item.track_id]
        if not tracks:
            return Response({"detail": "empty_playlist"}, status=status.HTTP_400_BAD_REQUEST)
        existing = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position", "id"))
        start_pos = len(existing)
        new_rows = [
            ChannelQueueItem(channel=channel, track=t, position=start_pos + i, added_by_id=request.user.id)
            for i, t in enumerate(tracks)
        ]
        ChannelQueueItem.objects.bulk_create(new_rows)
        session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        session.queue_version += 1
        session.save(update_fields=["queue_version", "updated_at"])
        serialized = _serialize_queue(channel_id, request.user.id)
        return Response({"added": len(new_rows), "results": serialized})


class ChannelSessionExportPlaylistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
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
        return Response({"playlist": PlaylistSerializer(dest, context={"request": request}).data}, status=status.HTTP_201_CREATED)
