"""Channel API — ChannelPlaylistSuggestionView."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.helpers import (
    _broadcast_queue_updated,
    _broadcast_suggestions_updated,
    _channel_closed_response,
    _log_channel_audit,
)
from apps.channels.models import (
    Channel,
    ChannelMembership,
    ChannelPlaylistSuggestion,
)
from apps.channels.permissions import can_manage_channel
from apps.channels.room.room_tools import parse_external_source
from apps.channels.serializers.channel_serializers import (
    ChannelPlaylistSuggestionSerializer,
)
from apps.core.services.webpush import notify_channel_new_suggestion_push
from apps.playback.models import PlaybackSession
from apps.playback.services.channel_queue import tracks_accessible_to_user


class ChannelPlaylistSuggestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        status_filter = str(request.query_params.get("status") or "").strip().lower()
        qs = ChannelPlaylistSuggestion.objects.filter(channel_id=channel_id).select_related(
            "user", "track", "reviewed_by"
        )
        if status_filter in {
            ChannelPlaylistSuggestion.Status.PENDING,
            ChannelPlaylistSuggestion.Status.APPROVED,
            ChannelPlaylistSuggestion.Status.REJECTED,
        }:
            qs = qs.filter(status=status_filter)
        rows = qs.order_by("-id")[:200]
        return Response({"results": ChannelPlaylistSuggestionSerializer(rows, many=True).data})

    def post(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        ex = channel.experience if isinstance(channel.experience, dict) else {}
        if ex.get("suggestions_enabled") is False:
            return Response({"detail": "suggestions_disabled"}, status=status.HTTP_403_FORBIDDEN)
        staff = can_manage_channel(request.user, channel_id)
        if not staff:
            hour_ago = timezone.now() - timedelta(hours=1)
            limit = max(1, min(20, int(ex.get("suggestion_rate_limit_per_hour") or 5)))
            recent = ChannelPlaylistSuggestion.objects.filter(
                channel_id=channel_id,
                user_id=request.user.id,
                created_at__gte=hour_ago,
            ).count()
            if recent >= limit:
                return Response({"detail": "suggestion_rate_limited"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        track_id = request.data.get("track_id")
        external_url = str(request.data.get("external_url") or "").strip()
        note = str(request.data.get("note") or "").strip()[:280]
        external_title = str(request.data.get("external_title") or "").strip()[:255]
        external_artist = str(request.data.get("external_artist") or "").strip()[:255]
        if not track_id and not external_url:
            return Response({"detail": "track_or_external_required"}, status=status.HTTP_400_BAD_REQUEST)
        if track_id and external_url:
            return Response({"detail": "track_or_external_not_both"}, status=status.HTTP_400_BAD_REQUEST)
        if track_id:
            if not tracks_accessible_to_user(request.user).filter(id=int(track_id)).exists():
                return Response({"detail": "track_not_accessible"}, status=status.HTTP_403_FORBIDDEN)
            row = ChannelPlaylistSuggestion.objects.create(
                channel_id=channel_id,
                track_id=int(track_id),
                user_id=request.user.id,
                note=note,
            )
            _log_channel_audit(
                channel_id, "suggestion.created", request.user.id, target_type="track", target_id=track_id
            )
        else:
            # parse_external_source from room_tools

            url, title, artist, source = parse_external_source(external_url)
            if not url:
                return Response({"detail": "invalid_external_url"}, status=status.HTTP_400_BAD_REQUEST)
            row = ChannelPlaylistSuggestion.objects.create(
                channel_id=channel_id,
                user_id=request.user.id,
                note=note,
                external_url=url,
                external_title=external_title or title,
                external_artist=external_artist or artist,
                external_source=source,
            )
            _log_channel_audit(channel_id, "suggestion.created", request.user.id, target_type="external", target_id=url)
        _broadcast_suggestions_updated(
            channel_id,
            event="created",
            actor_username=getattr(request.user, "username", None),
        )

        notify_channel_new_suggestion_push(channel_id, getattr(request.user, "username", "?"), request.user.id)
        return Response(ChannelPlaylistSuggestionSerializer(row).data, status=status.HTTP_201_CREATED)

    def patch(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        suggestion_id = request.data.get("suggestion_id")
        action = str(request.data.get("action") or "").strip().lower()
        if not suggestion_id or action not in {"approve", "reject"}:
            return Response({"detail": "invalid_payload"}, status=status.HTTP_400_BAD_REQUEST)
        row = get_object_or_404(ChannelPlaylistSuggestion, id=int(suggestion_id), channel_id=channel_id)
        row.status = (
            ChannelPlaylistSuggestion.Status.APPROVED
            if action == "approve"
            else ChannelPlaylistSuggestion.Status.REJECTED
        )
        row.reviewed_by_id = request.user.id
        row.reviewed_at = timezone.now()
        row.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        if action == "approve":
            channel = get_object_or_404(Channel, id=channel_id)
            if row.track_id and row.track:
                from apps.playback.services.channel_queue import insert_track_after_now_playing

                insert_track_after_now_playing(channel, row.track, added_by_id=row.user_id)
                session, _ = PlaybackSession.objects.get_or_create(channel=channel)
                session.queue_version += 1
                session.save(update_fields=["queue_version", "updated_at"])
                _broadcast_queue_updated(channel_id, request.user.id)
            elif row.external_url:
                from apps.playback.services.channel_queue import insert_track_after_now_playing
                from apps.tracks.services.external_audio_import import ExternalImportError, import_track_from_url

                try:
                    track = import_track_from_url(row.user_id, row.external_url)
                    insert_track_after_now_playing(channel, track, added_by_id=row.user_id)
                    session, _ = PlaybackSession.objects.get_or_create(channel=channel)
                    session.queue_version += 1
                    session.save(update_fields=["queue_version", "updated_at"])
                    _broadcast_queue_updated(channel_id, request.user.id)
                except ExternalImportError:
                    from apps.channels.chat_service import apply_chat_send

                    label = row.external_title or "Link"
                    artist = f" — {row.external_artist}" if row.external_artist else ""
                    body = f"🎧 {label}{artist}\n{row.external_url}"
                    apply_chat_send(channel_id, request.user, body)
        _log_channel_audit(
            channel_id, f"suggestion.{action}", request.user.id, target_type="suggestion", target_id=row.id
        )
        _broadcast_suggestions_updated(channel_id)
        return Response(ChannelPlaylistSuggestionSerializer(row).data)
