"""Track share permission mutations."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, User
from django.db.models import QuerySet

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import Channel, ChannelMembership
from apps.tracks.models import Track, TrackSharePermission


def list_track_shares(track: Track) -> QuerySet[TrackSharePermission]:
    return track.share_permissions.select_related("user", "channel").order_by("-created_at")


def create_track_share(
    user: AbstractBaseUser,
    track: Track,
    *,
    user_id: int | None = None,
    channel_id: int | None = None,
) -> tuple[TrackSharePermission | None, str | None, int | None]:
    if not user_id and not channel_id:
        return None, "user_id_or_channel_id_required", 400
    kwargs: dict = {"track": track}
    if user_id:
        target = User.objects.filter(id=int(user_id)).first()
        if target is None:
            return None, "not_found", 404
        kwargs["user"] = target
    if channel_id:
        channel = Channel.objects.filter(id=int(channel_id)).first()
        if channel is None:
            return None, "not_found", 404
        if (
            not is_platform_superuser(user)
            and not ChannelMembership.objects.filter(channel=channel, user=user, is_active=True).exists()
        ):
            return None, "channel_not_accessible", 403
        kwargs["channel"] = channel
    share, _ = TrackSharePermission.objects.get_or_create(**kwargs)
    return share, None, None


def delete_track_share(track: Track, share_id: int) -> tuple[bool, str | None]:
    deleted, _ = TrackSharePermission.objects.filter(id=int(share_id), track=track).delete()
    if not deleted:
        return False, "not_found"
    return True, None
