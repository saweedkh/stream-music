"""Friends / following live channel feed."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Count

from apps.channels.models import Channel, ChannelMembership
from apps.playback.models import PlaybackSession
from apps.social.models import ChannelFollow, UserFollow


def build_live_friends_feed(user: User) -> dict:
    followed_channel_ids = list(
        ChannelFollow.objects.filter(user_id=user.id).values_list("channel_id", flat=True)
    )
    followed_user_ids = list(UserFollow.objects.filter(follower_id=user.id).values_list("following_id", flat=True))
    member_channel_ids = list(
        ChannelMembership.objects.filter(user_id=user.id, is_active=True).values_list("channel_id", flat=True)
    )
    candidate_ids = set(followed_channel_ids) | set(member_channel_ids)
    if followed_user_ids:
        owner_live = Channel.objects.filter(
            owner_id__in=followed_user_ids, is_active=True
        ).values_list("id", flat=True)
        candidate_ids |= set(owner_live)

    sessions = {
        s.channel_id: s
        for s in PlaybackSession.objects.filter(channel_id__in=candidate_ids, is_playing=True).select_related(
            "track", "channel"
        )
    }
    results = []
    for cid in candidate_ids:
        ch = Channel.objects.filter(id=cid, is_active=True).first()
        if not ch:
            continue
        sess = sessions.get(cid)
        online = (
            ChannelMembership.objects.filter(channel_id=cid, is_active=True)
            .aggregate(n=Count("id"))
            .get("n")
            or 0
        )
        results.append(
            {
                "channel_id": ch.id,
                "channel_name": ch.name,
                "owner_username": getattr(ch.owner, "username", ""),
                "is_live": sess is not None,
                "now_playing": (
                    {"track_id": sess.track_id, "title": sess.track.title, "artist": sess.track.artist}
                    if sess and sess.track
                    else None
                ),
                "online_members": online,
                "public_slug": str(ch.public_slug),
            }
        )
    results.sort(key=lambda r: (not r["is_live"], -r["online_members"]))
    return {"results": results[:40]}
