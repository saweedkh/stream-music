"""Channel authorization helpers for API and services."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import ChannelMembership
from apps.playlists.models import Playlist
from apps.playlists.selectors import playlist_visible_to_user


def can_manage_channel(user: AbstractBaseUser, channel_id: int) -> bool:
    """Owner/moderator of an active membership, or platform superuser."""
    if is_platform_superuser(user):
        return True
    return ChannelMembership.objects.filter(
        channel_id=channel_id,
        user=user,
        role__in=[ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR],
        is_active=True,
    ).exists()


def can_edit_channel_playlist(user: AbstractBaseUser, playlist: Playlist) -> bool:
    """
    Personal playlists: owner only.

    Channel playlists: moderators/owners only (members are read-only).
    """
    if playlist.channel_id is None:
        return playlist.owner_id == user.id
    return can_manage_channel(user, playlist.channel_id)


def can_copy_playlist_to_channel(user: AbstractBaseUser, source: Playlist, channel_id: int) -> bool:
    """Moderator of target channel and may read the source playlist."""
    if not can_manage_channel(user, channel_id):
        return False
    return playlist_visible_to_user(user, source)
