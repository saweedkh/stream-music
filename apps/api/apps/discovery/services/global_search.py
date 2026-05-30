"""Global search across tracks, playlists, channels, users, shared playlists."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Q

from apps.channels.models import Channel
from apps.channels.serializers.channel_serializers import ChannelSerializer
from apps.discovery.selectors import public_channel_queryset
from apps.playback.services.channel_queue import tracks_accessible_to_user
from apps.playlists.models import Playlist, PlaylistShareLink
from apps.playlists.playlists.playlist_serializers import PlaylistSerializer
from apps.tracks.tracks.track_serializers import TrackSerializer


def build_global_search(request, q: str) -> dict:
    if len(q) < 2:
        return {"tracks": [], "playlists": [], "channels": [], "users": [], "shared_playlists": []}

    user = request.user
    track_qs = tracks_accessible_to_user(user).filter(
        Q(title__icontains=q) | Q(artist__icontains=q) | Q(album__icontains=q) | Q(genre__icontains=q)
    )[:20]
    playlist_qs = Playlist.objects.filter(owner=user, channel__isnull=True, name__icontains=q)[:15]
    member_ids = list(
        Channel.objects.filter(memberships__user=user, memberships__is_active=True)
        .filter(Q(name__icontains=q) | Q(description__icontains=q))
        .distinct()
        .values_list("id", flat=True)[:15]
    )
    pub_ids = list(
        public_channel_queryset()
        .filter(Q(name__icontains=q) | Q(description__icontains=q))
        .exclude(id__in=member_ids)
        .values_list("id", flat=True)[:10]
    )
    channel_ids = list(member_ids) + list(pub_ids)
    channel_rows = Channel.objects.filter(id__in=channel_ids).select_related("owner") if channel_ids else []
    user_rows = (
        User.objects.filter(is_active=True, public_profile__is_public=True)
        .filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
        .select_related("public_profile")[:12]
    )
    users = [
        {
            "id": u.id,
            "username": u.username,
            "display_name": (u.get_full_name() or u.username).strip(),
        }
        for u in user_rows
    ]
    shared_links = (
        PlaylistShareLink.objects.filter(is_active=True, playlist__name__icontains=q)
        .select_related("playlist", "playlist__owner")
        .order_by("-created_at")[:12]
    )
    shared_playlists = [
        {
            "token": str(link.token),
            "playlist_name": link.playlist.name if link.playlist else "",
            "owner_username": link.playlist.owner.username if link.playlist and link.playlist.owner_id else "",
        }
        for link in shared_links
    ]
    return {
        "tracks": TrackSerializer(track_qs, many=True, context={"request": request}).data,
        "playlists": PlaylistSerializer(playlist_qs, many=True, context={"request": request}).data,
        "channels": ChannelSerializer(channel_rows, many=True, context={"request": request}).data,
        "users": users,
        "shared_playlists": shared_playlists,
    }


def build_track_facets(user) -> dict:
    qs = tracks_accessible_to_user(user)
    genres = sorted({g for g in qs.exclude(genre="").values_list("genre", flat=True) if g})
    albums = sorted({a for a in qs.exclude(album="").values_list("album", flat=True)[:500] if a})
    tags: set[str] = set()
    for raw in qs.values_list("tags", flat=True)[:300]:
        if isinstance(raw, list):
            for t in raw:
                if isinstance(t, str) and t.strip():
                    tags.add(t.strip())
    return {"genres": genres, "albums": albums[:200], "tags": sorted(tags)[:100]}
