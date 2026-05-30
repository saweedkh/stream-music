"""Read-only playlist queries and visibility rules."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser
from django.db.models import Q, QuerySet

from apps.accounts.selectors import favorited_playlist_ids
from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import ChannelMembership
from apps.playback.services.channel_queue import tracks_accessible_to_user
from apps.playlists.models import Playlist, PlaylistItem, PlaylistShareLink

PLAYLIST_BULK_ADD_MAX = 150


def playlist_list_queryset(
    user: AbstractBaseUser,
    *,
    channel_id: str | int | None = None,
    favorited_only: bool = False,
) -> QuerySet[Playlist]:
    """Playlists visible in list API (owner, member, or favorited)."""
    base = Playlist.objects.select_related("owner", "channel")
    if is_platform_superuser(user):
        qs = base.all()
    elif channel_id is not None and channel_id != "":
        try:
            cid = int(channel_id)
        except (TypeError, ValueError):
            return base.none()
        if not ChannelMembership.objects.filter(channel_id=cid, user=user, is_active=True).exists():
            return base.none()
        qs = base.filter(channel_id=cid)
    else:
        qs = base.filter(
            Q(owner=user)
            | Q(channel__memberships__user=user, channel__memberships__is_active=True)
            | Q(favorited_by__user=user),
        ).distinct()
    if favorited_only:
        qs = qs.filter(favorited_by__user=user).distinct()
    return qs


def playlist_item_queryset(user: AbstractBaseUser, *, playlist_id: str | int | None = None) -> QuerySet[PlaylistItem]:
    base = PlaylistItem.objects.select_related("playlist", "track")
    if playlist_id is not None and playlist_id != "":
        try:
            pid = int(playlist_id)
        except (TypeError, ValueError):
            return base.none()
        playlist = Playlist.objects.filter(id=pid).select_related("channel").first()
        if playlist is None or not playlist_visible_to_user(user, playlist):
            return base.none()
        return base.filter(playlist_id=pid)
    return base.filter(
        Q(playlist__owner=user)
        | Q(playlist__channel__memberships__user=user, playlist__channel__memberships__is_active=True),
    ).distinct()


def playlist_visible_to_user(user: AbstractBaseUser, playlist: Playlist) -> bool:
    if is_platform_superuser(user):
        return True
    if playlist.owner_id == user.id:
        return True
    if playlist.id in favorited_playlist_ids(user):
        return True
    if playlist.channel_id:
        return ChannelMembership.objects.filter(channel_id=playlist.channel_id, user=user, is_active=True).exists()
    return PlaylistShareLink.objects.filter(playlist_id=playlist.id, is_active=True).exists()


def playlist_inaccessible_track_ids(user: AbstractBaseUser, playlist: Playlist) -> list[int]:
    track_ids = list(PlaylistItem.objects.filter(playlist=playlist).values_list("track_id", flat=True))
    if not track_ids:
        return []
    allowed = set(tracks_accessible_to_user(user).filter(id__in=track_ids).values_list("id", flat=True))
    seen: set[int] = set()
    blocked: list[int] = []
    for tid in track_ids:
        if tid in seen:
            continue
        seen.add(tid)
        if tid not in allowed:
            blocked.append(tid)
    return blocked
