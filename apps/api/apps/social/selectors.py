"""Read-only social graph queries."""

from __future__ import annotations

from apps.social.models import ChannelFollow, UserFollow


def user_is_following(follower_id: int, following_id: int) -> bool:
    return UserFollow.objects.filter(follower_id=follower_id, following_id=following_id).exists()


def channel_is_followed(user_id: int, channel_id: int) -> bool:
    return ChannelFollow.objects.filter(user_id=user_id, channel_id=channel_id).exists()
