"""Public profile read/update."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, User

from apps.accounts.selectors import (
    profile_stats_visible,
    public_playlists_for_user,
    public_profile_for_user,
    social_counts_for_profile,
    user_by_username,
)
from apps.accounts.user_badges import badges_for_user
from apps.discovery.selectors import public_channel_queryset
from apps.social.services.avatar import avatar_url_for


def build_public_profile_payload(
    user: User, viewer: AbstractBaseUser | None, request
) -> tuple[dict | None, str | None, int | None]:
    """
    Build JSON-serializable profile payload. Returns (payload, error_detail, http_status).
    """
    from apps.channels.serializers.channel_serializers import ChannelSerializer
    from apps.playlists.playlists.playlist_serializers import PlaylistSerializer

    profile, _ = public_profile_for_user(user.id)
    is_self = viewer is not None and getattr(viewer, "is_authenticated", False) and viewer.id == user.id
    if not profile.is_public and not is_self:
        return None, "profile_private", 403

    channels_data = []
    if profile.is_public or is_self:
        owned_public = public_channel_queryset().filter(owner_id=user.id).select_related("owner")[:30]
        channels_data = ChannelSerializer(owned_public, many=True, context={"request": request}).data

    social = social_counts_for_profile(
        user.id,
        viewer.id if viewer and getattr(viewer, "is_authenticated", False) else None,
        is_self=is_self,
        profile_is_public=profile.is_public,
    )
    stats = (
        profile_stats_visible(user.id) if profile.is_public or is_self else {"sessions_joined": 0, "tracks_played": 0}
    )

    public_playlists = []
    if profile.is_public or is_self:
        pub_pl = public_playlists_for_user(user.id)
        public_playlists = PlaylistSerializer(pub_pl, many=True, context={"request": request}).data

    gamification = None
    live_channels = []
    party_highlights = []
    recent_activity = []
    if profile.is_public:
        from apps.analytics.services.gamification import build_gamification_payload
        from apps.accounts.services.public_profile_enrichment import (
            live_public_channels_for_user,
            party_recap_highlights_for_user,
            recent_activity_for_user,
        )

        g = build_gamification_payload(user.id)
        gamification = {
            "level": g["level"],
            "points": g["points"],
            "streak_days": g["streak_days"],
        }
        live_channels = live_public_channels_for_user(user.id, request)
        party_highlights = party_recap_highlights_for_user(user.id)
        recent_activity = recent_activity_for_user(user.id)
    elif is_self:
        from apps.accounts.services.public_profile_enrichment import recent_activity_for_user

        recent_activity = recent_activity_for_user(user.id)

    return (
        {
            "user": {
                "id": user.id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "badges": badges_for_user(user),
                "date_joined": user.date_joined.isoformat() if user.date_joined else None,
                "avatar_url": avatar_url_for(profile, request=request),
            },
            "profile": {
                "bio": profile.bio,
                "is_public": profile.is_public,
                "avatar_url": avatar_url_for(profile, request=request),
            },
            "public_channels": channels_data,
            "public_playlists": public_playlists,
            "stats": {
                **stats,
                "channel_follows": social["following_count"] if is_self else None,
                "user_followers": social["follower_count"],
            },
            "following_count": social["following_count"],
            "follower_count": social["follower_count"],
            "user_following": social["user_following"],
            "is_self": is_self,
            "gamification": gamification,
            "live_channels": live_channels,
            "party_highlights": party_highlights,
            "recent_activity": recent_activity,
        },
        None,
        None,
    )


def get_public_profile_by_username(username: str, viewer: AbstractBaseUser | None, request):
    user = user_by_username(username)
    if user is None:
        return None, "not_found", 404
    return build_public_profile_payload(user, viewer, request)


def update_me_public_profile(user: AbstractBaseUser, data: dict, *, request=None) -> dict:
    from django.core.exceptions import ValidationError as DjangoValidationError

    from apps.social.services.avatar import avatar_url_for, validate_avatar_upload

    profile, _ = public_profile_for_user(user.id)
    if "bio" in data:
        profile.bio = str(data.get("bio") or "")[:500]
    if "is_public" in data:
        profile.is_public = _request_bool(data.get("is_public"))
    if _request_bool(data.get("avatar_clear")):
        if profile.avatar:
            profile.avatar.delete(save=False)
            profile.avatar = None
    uploaded = None
    if request is not None:
        uploaded = getattr(request, "FILES", {}).get("avatar")
    if uploaded is not None:
        try:
            validate_avatar_upload(uploaded)
        except DjangoValidationError as exc:
            code = exc.messages[0] if exc.messages else "avatar_invalid"
            raise ValueError(str(code)) from exc
        if profile.avatar:
            profile.avatar.delete(save=False)
        profile.avatar = uploaded
    profile.save()
    return {
        "bio": profile.bio,
        "is_public": profile.is_public,
        "avatar_url": avatar_url_for(profile, request=request),
    }


def _request_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")
