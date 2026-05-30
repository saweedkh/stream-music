"""Read-only account queries (favorites, profile stats)."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, User
from django.db.models import QuerySet

from apps.accounts.models import UserPlaylistFavorite, UserTrackFavorite
from apps.channels.models import ChannelMembership
from apps.playback.models import PlaybackEvent
from apps.playlists.models import Playlist
from apps.social.models import ChannelFollow, UserFollow, UserPublicProfile


def favorited_track_ids(user: AbstractBaseUser) -> set[int]:
    return set(UserTrackFavorite.objects.filter(user_id=user.id).values_list("track_id", flat=True))


def favorited_playlist_ids(user: AbstractBaseUser) -> set[int]:
    return set(UserPlaylistFavorite.objects.filter(user_id=user.id).values_list("playlist_id", flat=True))


def user_by_username(username: str) -> User | None:
    return User.objects.filter(username__iexact=username).first()


def public_profile_for_user(user_id: int) -> tuple[UserPublicProfile, bool]:
    return UserPublicProfile.objects.get_or_create(user_id=user_id)


def profile_stats_visible(user_id: int) -> dict[str, int]:
    sessions_joined = ChannelMembership.objects.filter(user_id=user_id, is_active=True).count()
    tracks_played = (
        PlaybackEvent.objects.filter(actor_id=user_id, track_id__isnull=False).values("track_id").distinct().count()
    )
    return {"sessions_joined": sessions_joined, "tracks_played": tracks_played}


def social_counts_for_profile(
    user_id: int,
    viewer_id: int | None,
    *,
    is_self: bool,
    profile_is_public: bool,
) -> dict[str, int | bool]:
    following_count = ChannelFollow.objects.filter(user_id=user_id).count() if is_self else 0
    follower_count = 0
    user_following = False
    if profile_is_public or is_self:
        follower_count = UserFollow.objects.filter(following_id=user_id).count()
        if viewer_id and not is_self:
            user_following = UserFollow.objects.filter(follower_id=viewer_id, following_id=user_id).exists()
    return {
        "following_count": following_count,
        "follower_count": follower_count,
        "user_following": user_following,
    }


def public_playlists_for_user(user_id: int, limit: int = 20) -> QuerySet[Playlist]:
    fav_ids = UserPlaylistFavorite.objects.filter(user_id=user_id).values_list("playlist_id", flat=True)[:30]
    return Playlist.objects.filter(owner_id=user_id, channel__isnull=True, id__in=fav_ids).order_by("-created_at")[
        :limit
    ]
