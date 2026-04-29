from apps.channels.models import ChannelMembership


def can_control_channel(user, channel_id: int) -> bool:
    if not user or not user.is_authenticated:
        return False
    return ChannelMembership.objects.filter(
        channel_id=channel_id,
        user=user,
        role__in=[ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR],
        is_active=True,
    ).exists()
