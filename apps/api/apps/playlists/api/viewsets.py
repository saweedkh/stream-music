from django.db import transaction
from django.db.models import Max, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.models import UserPlaylistFavorite
from apps.accounts.user_badges import is_platform_superuser
from apps.channels.api.helpers import (
    PLAYLIST_BULK_ADD_MAX,
    _can_copy_playlist_to_channel,
    _can_edit_channel_playlist,
    _can_manage_channel,
    _favorited_playlist_ids_for_user,
    _playlist_inaccessible_track_ids,
    _playlist_visible_to_user,
)
from apps.channels.models import Channel, ChannelMembership
from apps.playback.services.channel_queue import tracks_accessible_to_user
from apps.playlists.api.serializers import PlaylistItemSerializer, PlaylistSerializer
from apps.playlists.models import Playlist, PlaylistItem
from apps.tracks.models import Track


class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Playlist.objects.select_related("owner", "channel").all()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            ctx["favorited_playlist_ids"] = _favorited_playlist_ids_for_user(user)
        return ctx

    def get_queryset(self):
        user = self.request.user
        if is_platform_superuser(user):
            qs = self.queryset.all()
        else:
            channel_id = self.request.query_params.get("channel")
            if channel_id is not None and channel_id != "":
                try:
                    cid = int(channel_id)
                except ValueError:
                    return self.queryset.none()
                if not ChannelMembership.objects.filter(channel_id=cid, user=user, is_active=True).exists():
                    return self.queryset.none()
                qs = self.queryset.filter(channel_id=cid)
            else:
                qs = self.queryset.filter(
                    Q(owner=user)
                    | Q(channel__memberships__user=user, channel__memberships__is_active=True)
                    | Q(favorited_by__user=user),
                ).distinct()

        fav = (self.request.query_params.get("favorited") or "").strip().lower()
        if fav in ("1", "true", "yes"):
            qs = self.queryset.filter(favorited_by__user=user).distinct()
        return qs

    def perform_create(self, serializer):
        channel = serializer.validated_data.get("channel")
        if channel is not None and not _can_manage_channel(self.request.user, channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        playlist = self.get_object()
        user = self.request.user
        if "channel" in serializer.validated_data:
            new_channel = serializer.validated_data.get("channel")
            if new_channel is not None and not _can_manage_channel(user, new_channel.id):
                raise PermissionDenied("permission_denied")
            if playlist.channel_id is None and new_channel is not None and playlist.owner_id != user.id:
                raise PermissionDenied("permission_denied")
        if not _can_edit_channel_playlist(user, playlist):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_edit_channel_playlist(self.request.user, instance):
            raise PermissionDenied("permission_denied")
        instance.delete()

    @action(detail=True, methods=["post", "delete"], url_path="favorite")
    def favorite(self, request, pk=None):
        playlist = self.get_object()
        if not _playlist_visible_to_user(request.user, playlist):
            raise PermissionDenied("permission_denied")
        if request.method == "POST":
            UserPlaylistFavorite.objects.get_or_create(user=request.user, playlist=playlist)
            return Response({"is_favorited": True})
        UserPlaylistFavorite.objects.filter(user=request.user, playlist=playlist).delete()
        return Response({"is_favorited": False})

    @action(detail=True, methods=["post"], url_path="add-tracks")
    def add_tracks(self, request, pk=None):
        playlist = self.get_object()
        if not _can_edit_channel_playlist(request.user, playlist):
            raise PermissionDenied("permission_denied")

        raw_ids = request.data.get("track_ids")
        if not isinstance(raw_ids, list) or len(raw_ids) == 0:
            return Response({"detail": "track_ids_required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(raw_ids) > PLAYLIST_BULK_ADD_MAX:
            return Response(
                {"detail": "too_many_tracks", "max": PLAYLIST_BULK_ADD_MAX},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed: list[int] = []
        for x in raw_ids:
            try:
                parsed.append(int(x))
            except (TypeError, ValueError):
                return Response({"detail": "invalid_track_id"}, status=status.HTTP_400_BAD_REQUEST)

        seen: set[int] = set()
        ordered_unique: list[int] = []
        for tid in parsed:
            if tid in seen:
                continue
            seen.add(tid)
            ordered_unique.append(tid)

        allowed = set(tracks_accessible_to_user(request.user).filter(id__in=ordered_unique).values_list("id", flat=True))
        to_add = [tid for tid in ordered_unique if tid in allowed]

        with transaction.atomic():
            base = playlist.items.aggregate(m=Max("position"))["m"]
            start = 0 if base is None else int(base) + 1
            rows = [PlaylistItem(playlist=playlist, track_id=tid, position=start + i) for i, tid in enumerate(to_add)]
            if rows:
                PlaylistItem.objects.bulk_create(rows)

        return Response(
            {
                "added": len(to_add),
                "requested": len(parsed),
                "skipped_not_allowed": len(ordered_unique) - len(to_add),
            }
        )

    @action(detail=True, methods=["post"], url_path="copy-to-channel")
    def copy_to_channel(self, request, pk=None):
        source = self.get_object()
        try:
            channel_id = int(request.data.get("channel_id"))
        except (TypeError, ValueError):
            return Response({"detail": "channel_id_required"}, status=status.HTTP_400_BAD_REQUEST)
        channel = Channel.objects.filter(id=channel_id).first()
        if channel is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if not channel.is_active:
            return Response({"detail": "channel_closed"}, status=status.HTTP_403_FORBIDDEN)
        if not _can_copy_playlist_to_channel(request.user, source, channel_id):
            raise PermissionDenied("permission_denied")
        name = str(request.data.get("name") or "").strip() or source.name
        blocked = set(_playlist_inaccessible_track_ids(request.user, source))
        with transaction.atomic():
            dest = Playlist.objects.create(name=name[:255], owner=request.user, channel_id=channel_id)
            items = list(PlaylistItem.objects.filter(playlist=source).order_by("position", "id"))
            allowed_rows = [row for row in items if row.track_id not in blocked]
            if allowed_rows:
                PlaylistItem.objects.bulk_create(
                    [
                        PlaylistItem(
                            playlist=dest,
                            track_id=row.track_id,
                            position=idx,
                        )
                        for idx, row in enumerate(allowed_rows)
                    ]
                )
        payload = PlaylistSerializer(dest, context=self.get_serializer_context()).data
        return Response(
            {
                "playlist": payload,
                "added": len(allowed_rows) if items else 0,
                "skipped_inaccessible": len(blocked),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="assign-to-channel")
    def assign_to_channel(self, request, pk=None):
        """Link personal playlist to a channel (same object; edits apply for channel mods)."""
        source = self.get_object()
        try:
            channel_id = int(request.data.get("channel_id"))
        except (TypeError, ValueError):
            return Response({"detail": "channel_id_required"}, status=status.HTTP_400_BAD_REQUEST)
        channel = Channel.objects.filter(id=channel_id).first()
        if channel is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if not channel.is_active:
            return Response({"detail": "channel_closed"}, status=status.HTTP_403_FORBIDDEN)
        if not _can_manage_channel(request.user, channel_id):
            raise PermissionDenied("permission_denied")
        if source.channel_id is not None:
            return Response({"detail": "playlist_already_on_channel"}, status=status.HTTP_400_BAD_REQUEST)
        if source.owner_id != request.user.id and not is_platform_superuser(request.user):
            return Response({"detail": "playlist_assign_owner_only"}, status=status.HTTP_403_FORBIDDEN)
        blocked = _playlist_inaccessible_track_ids(request.user, source)
        if blocked:
            return Response(
                {
                    "detail": "playlist_has_inaccessible_tracks",
                    "inaccessible_count": len(blocked),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        source.channel_id = channel_id
        source.save(update_fields=["channel_id"])
        return Response(PlaylistSerializer(source, context=self.get_serializer_context()).data)


class PlaylistItemViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = PlaylistItem.objects.select_related("playlist", "track").all()

    def get_queryset(self):
        user = self.request.user
        playlist_id = self.request.query_params.get("playlist")
        if playlist_id is not None and playlist_id != "":
            try:
                pid = int(playlist_id)
            except ValueError:
                return PlaylistItem.objects.none()
            playlist = Playlist.objects.filter(id=pid).select_related("channel").first()
            if playlist is None:
                return PlaylistItem.objects.none()
            if not _playlist_visible_to_user(user, playlist):
                return PlaylistItem.objects.none()
            return self.queryset.filter(playlist_id=pid)

        return self.queryset.filter(
            Q(playlist__owner=user)
            | Q(playlist__channel__memberships__user=user, playlist__channel__memberships__is_active=True),
        ).distinct()

    def perform_create(self, serializer):
        playlist = serializer.validated_data["playlist"]
        track = serializer.validated_data["track"]
        if not _can_edit_channel_playlist(self.request.user, playlist):
            raise PermissionDenied("permission_denied")
        can_use_track = track.owner_id == self.request.user.id or track.visibility in {
            Track.Visibility.PUBLIC_LAN,
            Track.Visibility.SHARED_WITH_CHANNELS,
            Track.Visibility.SHARED_WITH_USERS,
        }
        if not can_use_track:
            raise PermissionDenied("track_not_visible")
        serializer.save()

    def partial_update(self, request, *args, **kwargs):
        item = self.get_object()
        if not _can_edit_channel_playlist(request.user, item.playlist):
            raise PermissionDenied("permission_denied")
        if "position" not in request.data:
            return super().partial_update(request, *args, **kwargs)

        new_position = max(0, int(request.data.get("position", 0)))
        rows = list(PlaylistItem.objects.filter(playlist=item.playlist).order_by("position", "id"))
        rows = [row for row in rows if row.id != item.id]
        if new_position > len(rows):
            new_position = len(rows)
        rows.insert(new_position, item)
        for index, row in enumerate(rows):
            if row.position != index:
                row.position = index
                row.save(update_fields=["position"])
        item.refresh_from_db()
        return Response(PlaylistItemSerializer(item).data)

    def perform_destroy(self, instance):
        if not _can_edit_channel_playlist(self.request.user, instance.playlist):
            raise PermissionDenied("permission_denied")
        instance.delete()
