"""Platform social graph queries for admin."""

from __future__ import annotations

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.social.models import ActivityEvent, ChannelFollow, ReferralCode, UserFollow, UserPublicProfile


def build_social_overview() -> dict:
    profiles = UserPublicProfile.objects.aggregate(
        total=Count("id"),
        public=Count("id", filter=Q(is_public=True)),
    )
    with_avatar = UserPublicProfile.objects.exclude(avatar="").count()
    since_7d = timezone.now() - timezone.timedelta(days=7)
    activity_by_kind = {
        row["kind"]: row["count"]
        for row in ActivityEvent.objects.values("kind").annotate(count=Count("id"))
    }
    return {
        "profiles": {
            "total": int(profiles["total"] or 0),
            "public": int(profiles["public"] or 0),
            "private": int(profiles["total"] or 0) - int(profiles["public"] or 0),
            "with_avatar": with_avatar,
        },
        "follows": {
            "channel_follows_total": ChannelFollow.objects.count(),
            "user_follows_total": UserFollow.objects.count(),
        },
        "referrals": {
            "codes_total": ReferralCode.objects.count(),
            "total_signups": int(ReferralCode.objects.aggregate(total=Sum("signup_count"))["total"] or 0),
        },
        "activity": {
            "events_total": ActivityEvent.objects.count(),
            "events_7d": ActivityEvent.objects.filter(created_at__gte=since_7d).count(),
            "by_kind": activity_by_kind,
        },
    }


def list_public_profiles(
    *,
    search: str = "",
    is_public: str = "all",
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    qs = UserPublicProfile.objects.select_related("user").order_by("-updated_at")
    if is_public == "true":
        qs = qs.filter(is_public=True)
    elif is_public == "false":
        qs = qs.filter(is_public=False)
    if search:
        qs = qs.filter(Q(user__username__icontains=search) | Q(bio__icontains=search))
    total = qs.count()
    results = []
    for profile in qs[offset : offset + limit]:
        follower_count = UserFollow.objects.filter(following_id=profile.user_id).count()
        following_channels = ChannelFollow.objects.filter(user_id=profile.user_id).count()
        results.append(
            {
                "user_id": profile.user_id,
                "username": profile.user.username,
                "email": profile.user.email or "",
                "bio": profile.bio,
                "is_public": profile.is_public,
                "has_avatar": bool(profile.avatar),
                "follower_count": follower_count,
                "following_channels_count": following_channels,
                "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
            }
        )
    return results, total


def list_channel_follows(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = ChannelFollow.objects.select_related("user", "channel").order_by("-created_at")
    if search:
        qs = qs.filter(Q(user__username__icontains=search) | Q(channel__name__icontains=search))
    total = qs.count()
    results = [
        {
            "id": row.id,
            "user_id": row.user_id,
            "username": row.user.username,
            "channel_id": row.channel_id,
            "channel_name": row.channel.name,
            "notify_live": row.notify_live,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in qs[offset : offset + limit]
    ]
    return results, total


def list_user_follows(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = UserFollow.objects.select_related("follower", "following").order_by("-created_at")
    if search:
        qs = qs.filter(
            Q(follower__username__icontains=search) | Q(following__username__icontains=search)
        )
    total = qs.count()
    results = [
        {
            "id": row.id,
            "follower_id": row.follower_id,
            "follower_username": row.follower.username,
            "following_id": row.following_id,
            "following_username": row.following.username,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in qs[offset : offset + limit]
    ]
    return results, total


def list_referral_codes(*, search: str = "", offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    qs = ReferralCode.objects.select_related("user").order_by("-signup_count", "-created_at")
    if search:
        qs = qs.filter(Q(code__icontains=search) | Q(user__username__icontains=search))
    total = qs.count()
    results = [
        {
            "user_id": row.user_id,
            "username": row.user.username,
            "code": row.code,
            "signup_count": row.signup_count,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in qs[offset : offset + limit]
    ]
    return results, total


def list_activity_events(
    *,
    search: str = "",
    kind: str = "",
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    qs = ActivityEvent.objects.select_related("actor", "channel").order_by("-created_at")
    if kind and kind != "all":
        qs = qs.filter(kind=kind)
    if search:
        qs = qs.filter(
            Q(actor__username__icontains=search)
            | Q(channel__name__icontains=search)
        )
    total = qs.count()
    results = [
        {
            "id": row.id,
            "kind": row.kind,
            "actor_id": row.actor_id,
            "actor_username": row.actor.username,
            "channel_id": row.channel_id,
            "channel_name": row.channel.name if row.channel_id else None,
            "metadata": row.metadata,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in qs[offset : offset + limit]
    ]
    return results, total
