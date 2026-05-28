from apps.channels.models import ChannelMembership
from apps.common.serializers import ChannelSerializer
from apps.social.models import ChannelFollow
from apps.discovery.selectors import channel_is_live


def build_following_channels_feed(request) -> dict:
    rows = (
        ChannelFollow.objects.filter(user_id=request.user.id)
        .select_related("channel", "channel__owner")
        .order_by("-created_at")[:100]
    )
    member_channel_ids = set(
        ChannelMembership.objects.filter(user_id=request.user.id, is_active=True).values_list("channel_id", flat=True)
    )
    results = []
    for follow in rows:
        ch = follow.channel
        if not ch.is_active:
            continue
        results.append(
            {
                "channel": ChannelSerializer(ch, context={"request": request}).data,
                "notify_live": follow.notify_live,
                "is_live": channel_is_live(ch),
                "is_member": ch.id in member_channel_ids,
                "followed_at": follow.created_at.isoformat() if follow.created_at else None,
            }
        )
    results.sort(key=lambda r: (not r["is_live"], r["channel"]["name"]))
    return {"results": results}
