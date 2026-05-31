"""Channel room views: invites, chat, members, settings, audit."""

import json
import uuid
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser, user_badge_flags
from apps.channels.api.helpers import (
    _ALLOWED_EXPERIENCE_KEYS,
    _broadcast_queue_updated,
    _broadcast_suggestions_updated,
    _can_manage_channel,
    _channel_closed_response,
    _log_channel_audit,
    _normalize_public_join_slug_for_save,
)
from apps.channels.api.room_tools import parse_external_source
from apps.channels.api.serializers import (
    ChannelAuditLogSerializer,
    ChannelChatMessageSerializer,
    ChannelNotificationPreferenceSerializer,
    ChannelPlaylistSuggestionSerializer,
    ChannelSerializer,
    ChannelTrackReactionSerializer,
    InviteTokenSerializer,
    MembershipSerializer,
)
from apps.channels.models import (
    Channel,
    ChannelAuditLog,
    ChannelChatMessage,
    ChannelMembership,
    ChannelNotificationPreference,
    ChannelPlaylistSuggestion,
    ChannelTrackReaction,
    InviteToken,
)
from apps.channels.services.brand_media import assign_channel_brand_logo, clear_channel_brand_logo
from apps.channels.services.party_recap import build_party_recap
from apps.playlists.api.serializers import TrackSerializer
from apps.playback.api.serializers import PlaybackEventSerializer
from apps.playback.models import PlaybackEvent, PlaybackSession
from apps.playback.services.channel_queue import tracks_accessible_to_user
from apps.playback.services.state_store import playback_state_store
from apps.tracks.models import Track


class ChannelInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        max_uses = int(request.data.get("max_uses", 0) or 0)
        expires_in_hours = int(request.data.get("expires_in_hours", 0) or 0)
        expires_at = timezone.now() + timedelta(hours=expires_in_hours) if expires_in_hours > 0 else None
        invite = InviteToken.objects.create(
            channel=channel,
            created_by=request.user,
            max_uses=max_uses,
            expires_at=expires_at,
            is_active=True,
        )
        return Response(
            {
                "token": str(invite.token),
                "invite_url": f"/join/private/{invite.token}",
                "invite": InviteTokenSerializer(invite).data,
            }
        )

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        invites = InviteToken.objects.filter(channel_id=channel_id).order_by("-created_at")[:20]
        return Response({"results": InviteTokenSerializer(invites, many=True).data})



class ChannelInviteRotateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        InviteToken.objects.filter(channel=channel, is_active=True).update(is_active=False)
        invite = InviteToken.objects.create(channel=channel, created_by=request.user, is_active=True)
        return Response({"token": str(invite.token), "invite_url": f"/join/private/{invite.token}"})



class ChannelPublicLinkRotateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        channel.public_slug = uuid.uuid4()
        channel.save(update_fields=["public_slug", "updated_at"])
        return Response({"public_url": f"/join/public/{channel.public_slug}"})



class ChannelSimilarTracksView(APIView):
    """Tracks in this channel's playlists that share the same artist string as `from_track`."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id:
            return _channel_closed_response()
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        from_track_id = request.query_params.get("from_track")
        if not from_track_id:
            return Response({"results": []})
        try:
            tid = int(from_track_id)
        except (TypeError, ValueError):
            return Response({"results": []})
        ref = Track.objects.filter(id=tid).first()
        if ref is None:
            return Response({"results": []})
        artist = (ref.artist or "").strip()
        if not artist:
            return Response({"results": []})
        qs = (
            Track.objects.filter(playlist_items__playlist__channel_id=channel.id)
            .exclude(id=ref.id)
            .filter(artist__iexact=artist)
            .distinct()
            .order_by("title")[:24]
        )
        return Response({"results": TrackSerializer(qs, many=True, context={"request": request}).data})



class ChannelChatView(APIView):
    """Channel-scoped chat: only active members of this channel can read or post."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id:
            return _channel_closed_response()
        try:
            limit = int(request.query_params.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = min(100, max(1, limit))
        qs = (
            ChannelChatMessage.objects.filter(channel_id=channel_id)
            .select_related("user")
            .prefetch_related("reactions__user")
            .order_by("-id")
        )
        before = request.query_params.get("before")
        if before:
            try:
                bid = int(before)
                qs = qs.filter(id__lt=bid)
            except (TypeError, ValueError):
                pass
        rows = list(qs[:limit])
        rows.reverse()
        return Response({"results": ChannelChatMessageSerializer(rows, many=True, context={"request": request}).data})



class ChannelChatPinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        msg = (
            ChannelChatMessage.objects.filter(channel_id=channel_id, is_pinned=True)
            .select_related("user", "pinned_by")
            .prefetch_related("reactions__user")
            .order_by("-pinned_at", "-id")
            .first()
        )
        return Response({"message": ChannelChatMessageSerializer(msg, context={"request": request}).data if msg else None})

    def put(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        message_id = request.data.get("message_id")
        with transaction.atomic():
            ChannelChatMessage.objects.filter(channel_id=channel_id, is_pinned=True).update(
                is_pinned=False,
                pinned_at=None,
                pinned_by=None,
            )
            if message_id in (None, "", 0):
                _log_channel_audit(channel_id, "chat.unpin_all", request.user.id, target_type="chat_message")
                return Response({"message": None})
            msg = get_object_or_404(ChannelChatMessage, id=int(message_id), channel_id=channel_id)
            msg.is_pinned = True
            msg.pinned_at = timezone.now()
            msg.pinned_by = request.user
            msg.save(update_fields=["is_pinned", "pinned_at", "pinned_by"])
            _log_channel_audit(channel_id, "chat.pin", request.user.id, target_type="chat_message", target_id=msg.id)
        return Response({"message": ChannelChatMessageSerializer(msg, context={"request": request}).data})



class ChannelTrackReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        track_id = request.query_params.get("track_id")
        qs = ChannelTrackReaction.objects.filter(channel_id=channel_id).select_related("user")
        if track_id:
            qs = qs.filter(track_id=track_id)
        rows = qs.order_by("-id")[:250]
        return Response({"results": ChannelTrackReactionSerializer(rows, many=True).data})

    def post(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        track_id = request.data.get("track_id")
        emoji = str(request.data.get("emoji") or "").strip()[:16]
        if not track_id or not emoji:
            return Response({"detail": "track_id_and_emoji_required"}, status=status.HTTP_400_BAD_REQUEST)
        row, _ = ChannelTrackReaction.objects.get_or_create(
            channel_id=channel_id,
            track_id=int(track_id),
            user_id=request.user.id,
            emoji=emoji,
        )
        _log_channel_audit(channel_id, "track.react", request.user.id, target_type="track", target_id=track_id, metadata={"emoji": emoji})
        return Response(ChannelTrackReactionSerializer(row).data, status=status.HTTP_201_CREATED)



class ChannelPlaybackHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        limit = min(200, max(1, int(request.query_params.get("limit", 60) or 60)))
        rows = PlaybackEvent.objects.filter(channel_id=channel_id).select_related("actor", "track").order_by("-id")[:limit]
        return Response({"results": PlaybackEventSerializer(rows, many=True).data})



class ChannelAuditLogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        limit = min(200, max(1, int(request.query_params.get("limit", 80) or 80)))
        rows = ChannelAuditLog.objects.filter(channel_id=channel_id).select_related("actor").order_by("-id")[:limit]
        return Response({"results": ChannelAuditLogSerializer(rows, many=True).data})



class ChannelPlaylistSuggestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        status_filter = str(request.query_params.get("status") or "").strip().lower()
        qs = ChannelPlaylistSuggestion.objects.filter(channel_id=channel_id).select_related("user", "track", "reviewed_by")
        if status_filter in {ChannelPlaylistSuggestion.Status.PENDING, ChannelPlaylistSuggestion.Status.APPROVED, ChannelPlaylistSuggestion.Status.REJECTED}:
            qs = qs.filter(status=status_filter)
        rows = qs.order_by("-id")[:200]
        return Response({"results": ChannelPlaylistSuggestionSerializer(rows, many=True).data})

    def post(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        ex = channel.experience if isinstance(channel.experience, dict) else {}
        if ex.get("suggestions_enabled") is False:
            return Response({"detail": "suggestions_disabled"}, status=status.HTTP_403_FORBIDDEN)
        staff = _can_manage_channel(request.user, channel_id)
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
            _log_channel_audit(channel_id, "suggestion.created", request.user.id, target_type="track", target_id=track_id)
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
        from apps.core.services.webpush import notify_channel_new_suggestion_push

        notify_channel_new_suggestion_push(channel_id, getattr(request.user, "username", "?"), request.user.id)
        return Response(ChannelPlaylistSuggestionSerializer(row).data, status=status.HTTP_201_CREATED)

    def patch(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        suggestion_id = request.data.get("suggestion_id")
        action = str(request.data.get("action") or "").strip().lower()
        if not suggestion_id or action not in {"approve", "reject"}:
            return Response({"detail": "invalid_payload"}, status=status.HTTP_400_BAD_REQUEST)
        row = get_object_or_404(ChannelPlaylistSuggestion, id=int(suggestion_id), channel_id=channel_id)
        row.status = ChannelPlaylistSuggestion.Status.APPROVED if action == "approve" else ChannelPlaylistSuggestion.Status.REJECTED
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
                from apps.channels.chat_service import apply_chat_send

                label = row.external_title or "Link"
                artist = f" — {row.external_artist}" if row.external_artist else ""
                body = f"🎧 {label}{artist}\n{row.external_url}"
                apply_chat_send(channel_id, request.user, body)
        _log_channel_audit(channel_id, f"suggestion.{action}", request.user.id, target_type="suggestion", target_id=row.id)
        _broadcast_suggestions_updated(channel_id)
        return Response(ChannelPlaylistSuggestionSerializer(row).data)



class ChannelNotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=request.user.id)
        return Response(ChannelNotificationPreferenceSerializer(row).data)

    def patch(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=request.user.id)
        for field in [
            "muted",
            "notify_room_started",
            "notify_queue_turn",
            "notify_skip_threshold",
            "notify_moderation",
        ]:
            if field in request.data:
                setattr(row, field, bool(request.data.get(field)))
        row.save()
        return Response(ChannelNotificationPreferenceSerializer(row).data)



def _request_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")


class ChannelSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def patch(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        update_fields = []
        for field in ["name", "description", "privacy", "join_requires_approval"]:
            if field in request.data:
                setattr(channel, field, request.data[field])
                update_fields.append(field)
        if "member_limit" in request.data:
            from apps.accounts.premium_limits import clamp_member_limit

            channel.member_limit = clamp_member_limit(channel.owner, request.data.get("member_limit", channel.member_limit))
            update_fields.append("member_limit")
        if "public_join_slug" in request.data:
            if channel.privacy == Channel.Privacy.PRIVATE:
                if _normalize_public_join_slug_for_save(request.data.get("public_join_slug")) not in (None, False):
                    return Response({"detail": "public_join_slug_not_allowed"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                normalized = _normalize_public_join_slug_for_save(request.data.get("public_join_slug"))
                if normalized is False:
                    return Response({"detail": "invalid_public_join_slug"}, status=status.HTTP_400_BAD_REQUEST)
                if normalized is None:
                    channel.public_join_slug = None
                else:
                    taken = (
                        Channel.objects.exclude(pk=channel.pk)
                        .filter(public_join_slug__iexact=normalized)
                        .exists()
                    )
                    if taken:
                        return Response({"detail": "public_join_slug_taken"}, status=status.HTTP_400_BAD_REQUEST)
                    channel.public_join_slug = normalized
                update_fields.append("public_join_slug")
        if channel.privacy == Channel.Privacy.PRIVATE and channel.public_join_slug:
            channel.public_join_slug = None
            if "public_join_slug" not in update_fields:
                update_fields.append("public_join_slug")
        if "experience" in request.data:
            raw = request.data.get("experience")
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except json.JSONDecodeError:
                    return Response({"detail": "invalid_experience"}, status=status.HTTP_400_BAD_REQUEST)
            if isinstance(raw, dict):
                ex = dict(channel.experience or {})
                for k, v in raw.items():
                    if k not in _ALLOWED_EXPERIENCE_KEYS:
                        continue
                    if k == "chat_word_filters" and isinstance(v, list):
                        ex[k] = [str(w).strip().lower()[:64] for w in v if str(w).strip()][:50]
                    else:
                        ex[k] = v
                channel.experience = ex
                update_fields.append("experience")
        if _request_bool(request.data.get("brand_logo_clear")):
            clear_channel_brand_logo(channel)
            update_fields.append("brand_logo")
        uploaded_logo = getattr(request, "FILES", {}).get("brand_logo")
        if uploaded_logo is not None:
            try:
                assign_channel_brand_logo(channel, uploaded_logo)
            except DjangoValidationError as exc:
                code = exc.messages[0] if exc.messages else "brand_logo_invalid"
                return Response({"detail": str(code)}, status=status.HTTP_400_BAD_REQUEST)
            update_fields.append("brand_logo")
        if not update_fields:
            return Response(ChannelSerializer(channel, context={"request": request}).data)
        update_fields.append("updated_at")
        channel.save(update_fields=list(dict.fromkeys(update_fields)))
        _log_channel_audit(
            channel.id,
            "channel.settings_updated",
            request.user.id,
            target_type="channel",
            target_id=channel.id,
            metadata={"fields": list(dict.fromkeys(update_fields))},
        )
        return Response(ChannelSerializer(channel, context={"request": request}).data)



class ChannelLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        membership = ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).first()
        if not membership:
            return Response({"detail": "not_a_member"}, status=status.HTTP_400_BAD_REQUEST)
        if channel.owner_id == request.user.id or membership.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "owner_cannot_leave"}, status=status.HTTP_400_BAD_REQUEST)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        _log_channel_audit(channel.id, "membership.leave", request.user.id, target_type="membership", target_id=membership.id)
        return Response(status=status.HTTP_204_NO_CONTENT)



class ChannelCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.owner_id != request.user.id and not is_platform_superuser(request.user):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if not channel.is_active:
            return Response(status=status.HTTP_204_NO_CONTENT)
        channel.is_active = False
        channel.save(update_fields=["is_active", "updated_at"])
        playback_state_store.clear_channel(channel.id)
        _log_channel_audit(channel.id, "channel.closed", request.user.id, target_type="channel", target_id=channel.id)
        return Response(status=status.HTTP_204_NO_CONTENT)



class ChannelReopenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.owner_id != request.user.id and not is_platform_superuser(request.user):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if channel.is_active:
            return Response(status=status.HTTP_204_NO_CONTENT)
        channel.is_active = True
        channel.save(update_fields=["is_active", "updated_at"])
        _log_channel_audit(channel.id, "channel.reopened", request.user.id, target_type="channel", target_id=channel.id)
        return Response(status=status.HTTP_204_NO_CONTENT)



class ChannelMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not _can_manage_channel(request.user, channel_id):
            if not ChannelMembership.objects.filter(
                channel_id=channel_id, user=request.user, is_active=True
            ).exists():
                return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        from apps.social.services.avatar import avatar_urls_for_user_ids

        member_list = list(
            ChannelMembership.objects.filter(channel_id=channel_id).select_related("user").order_by("joined_at")
        )
        avatars = avatar_urls_for_user_ids([m.user_id for m in member_list])
        data = [
            {
                "id": m.id,
                "user_id": m.user_id,
                "username": m.user.username,
                "role": m.role,
                "is_active": m.is_active,
                "joined_at": m.joined_at,
                "avatar_url": avatars.get(m.user_id),
                **user_badge_flags(m.user),
            }
            for m in member_list
        ]
        return Response({"results": data})



class ChannelMemberManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, channel_id: int, member_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(ChannelMembership, id=member_id, channel_id=channel_id)
        role = request.data.get("role")
        if role not in [ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR, ChannelMembership.Role.MEMBER]:
            return Response({"detail": "invalid_role"}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == ChannelMembership.Role.OWNER and role != ChannelMembership.Role.OWNER:
            current_owners = ChannelMembership.objects.filter(channel_id=channel_id, role=ChannelMembership.Role.OWNER, is_active=True).count()
            if current_owners <= 1:
                return Response({"detail": "owner_must_be_unique"}, status=status.HTTP_400_BAD_REQUEST)
        if role == ChannelMembership.Role.OWNER:
            ChannelMembership.objects.filter(channel_id=channel_id, role=ChannelMembership.Role.OWNER).exclude(id=membership.id).update(
                role=ChannelMembership.Role.MODERATOR
            )
            channel = membership.channel
            channel.owner_id = membership.user_id
            channel.save(update_fields=["owner", "updated_at"])
        membership.role = role
        membership.save(update_fields=["role"])
        _log_channel_audit(channel_id, "membership.role_changed", request.user.id, target_type="membership", target_id=membership.id, metadata={"role": role})
        return Response(MembershipSerializer(membership).data)

    def delete(self, request, channel_id: int, member_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(ChannelMembership, id=member_id, channel_id=channel_id)
        if membership.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "cannot_remove_owner"}, status=status.HTTP_400_BAD_REQUEST)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        _log_channel_audit(channel_id, "membership.removed", request.user.id, target_type="membership", target_id=membership.id)
        return Response(status=status.HTTP_204_NO_CONTENT)




class ChannelAuditExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        import csv
        from django.http import HttpResponse

        limit = min(500, max(1, int(request.query_params.get("limit", 200) or 200)))
        rows = ChannelAuditLog.objects.filter(channel_id=channel_id).select_related("actor").order_by("-id")[:limit]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="channel-{channel_id}-audit.csv"'
        writer = csv.writer(response)
        writer.writerow(["id", "action", "actor", "target_type", "target_id", "created_at"])
        for row in rows:
            writer.writerow(
                [
                    row.id,
                    row.action,
                    row.actor.username if row.actor_id else "",
                    row.target_type,
                    row.target_id,
                    row.created_at.isoformat() if row.created_at else "",
                ]
            )
        return response



class ChannelPartyRecapView(APIView):
    """Public read-only recap for post-party pages (public/unlisted channels)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.privacy == Channel.Privacy.PRIVATE:
            return Response({"detail": "private"}, status=status.HTTP_403_FORBIDDEN)
        

        return Response(build_party_recap(channel))

