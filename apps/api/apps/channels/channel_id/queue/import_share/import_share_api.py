"""Import queue from playlist share link."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.helpers import _serialize_queue
from apps.channels.models import Channel
from apps.channels.permissions import can_manage_channel
from apps.playback.models import PlaybackSession
from apps.playlists.models import ChannelQueueItem, PlaylistItem, PlaylistShareLink


class ChannelQueueImportShareView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
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
        src_items = (
            PlaylistItem.objects.filter(playlist=link.playlist).select_related("track").order_by("position", "id")
        )
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
