"""Channel join, invite validation, and public slug helpers."""

from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from apps.channels.constants import PUBLIC_JOIN_CODE_RE, UUID_TOKEN_RE
from apps.channels.models import Channel, ChannelJoinRequest, ChannelMembership, InviteToken
from apps.channels.serializers.channel_serializers import MembershipSerializer
from apps.channels.services.channel_room import channel_closed_response


def normalize_public_join_slug_for_save(raw) -> str | None | bool:
    """Return normalized slug, None to clear, False if invalid."""
    from apps.channels.constants import PUBLIC_JOIN_RESERVED

    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
        return None
    s = str(raw).strip().lower()
    if len(s) > 40 or s in PUBLIC_JOIN_RESERVED or s.isdigit():
        return False
    if not PUBLIC_JOIN_CODE_RE.match(s):
        return False
    return s


def resolve_public_join_segment(seg: str) -> Channel | None:
    low = seg.strip().lower()
    ch = Channel.objects.filter(public_join_slug__iexact=low).first()
    if ch:
        return ch
    if UUID_TOKEN_RE.match(seg):
        return Channel.objects.filter(public_slug=seg).first()
    return None


def validate_private_invite(channel: Channel, token_value, user=None) -> tuple[Response | None, InviteToken | None]:
    if channel.privacy != Channel.Privacy.PRIVATE:
        return None, None
    if user is not None and channel.owner_id == user.id:
        return None, None
    invite = InviteToken.objects.filter(channel=channel, token=token_value, is_active=True).first()
    if not invite:
        return Response({"detail": "invite_required"}, status=status.HTTP_403_FORBIDDEN), None
    if invite.expires_at and invite.expires_at <= timezone.now():
        return Response({"detail": "invite_expired"}, status=status.HTTP_403_FORBIDDEN), None
    if invite.max_uses and invite.used_count >= invite.max_uses:
        return Response({"detail": "invite_exhausted"}, status=status.HTTP_403_FORBIDDEN), None
    return None, invite


def consume_invite(invite: InviteToken) -> None:
    invite.used_count += 1
    invite.save(update_fields=["used_count"])


def perform_channel_join(user, channel: Channel, token_value) -> Response:
    membership = ChannelMembership.objects.filter(channel=channel, user=user).first()
    if membership and membership.is_active:
        if not channel.is_active and channel.owner_id != user.id:
            return channel_closed_response()
        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)

    if membership and not membership.is_active:
        if not channel.is_active and channel.owner_id != user.id:
            return channel_closed_response()
        active_members = ChannelMembership.objects.filter(channel=channel, is_active=True).count()
        if active_members >= channel.member_limit:
            return Response({"detail": "channel_full"}, status=status.HTTP_403_FORBIDDEN)
        err, invite = validate_private_invite(channel, token_value, user=user)
        if err:
            if channel.privacy != Channel.Privacy.PRIVATE or channel.owner_id == user.id:
                return err
        elif invite:
            consume_invite(invite)
        membership.is_active = True
        membership.save(update_fields=["is_active"])
        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)

    if not channel.is_active:
        return channel_closed_response()

    err, invite = validate_private_invite(channel, token_value, user=user)
    if err:
        return err
    active_members = ChannelMembership.objects.filter(channel=channel, is_active=True).count()
    if active_members >= channel.member_limit:
        return Response({"detail": "channel_full"}, status=status.HTTP_403_FORBIDDEN)

    if channel.join_requires_approval:
        existing_pending = ChannelJoinRequest.objects.filter(
            channel=channel, user=user, status=ChannelJoinRequest.Status.PENDING
        ).first()
        if existing_pending:
            return Response(
                {
                    "status": "pending",
                    "message": "join_request_pending",
                    "channel": channel.id,
                    "request_id": existing_pending.id,
                },
                status=status.HTTP_202_ACCEPTED,
            )
        ChannelJoinRequest.objects.create(
            channel=channel,
            user=user,
            status=ChannelJoinRequest.Status.PENDING,
            invite=invite if channel.privacy == Channel.Privacy.PRIVATE else None,
        )
        from apps.core.services.webpush import notify_channel_join_request_push

        notify_channel_join_request_push(channel.id, getattr(user, "username", "?"), user.id)
        return Response(
            {"status": "pending", "message": "join_request_created", "channel": channel.id},
            status=status.HTTP_202_ACCEPTED,
        )

    if channel.privacy == Channel.Privacy.PRIVATE and invite:
        consume_invite(invite)

    membership, _ = ChannelMembership.objects.get_or_create(channel=channel, user=user)
    membership.is_active = True
    membership.save(update_fields=["is_active"])
    return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)
