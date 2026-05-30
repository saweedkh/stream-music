"""Channel API — ChannelJoinFromLinkView."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.constants import PUBLIC_JOIN_CODE_RE, UUID_TOKEN_RE
from apps.channels.helpers import (
    _resolve_public_join_segment,
    perform_channel_join,
)
from apps.channels.models import Channel, InviteToken


class ChannelJoinFromLinkView(APIView):
    """Join from numeric id, invite UUID, public slug/code, or pasted URL path."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        raw = (request.data.get("link") or "").strip()
        extra_token = request.data.get("token")
        if not raw:
            return Response({"detail": "link_required"}, status=status.HTTP_400_BAD_REQUEST)

        if re.fullmatch(r"\d+", raw):
            channel = Channel.objects.filter(id=int(raw)).first()
            if not channel:
                return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            return perform_channel_join(request.user, channel, extra_token)

        if UUID_TOKEN_RE.match(raw):
            invite = InviteToken.objects.filter(token=raw, is_active=True).select_related("channel").first()
            if invite:
                return perform_channel_join(request.user, invite.channel, str(invite.token))
            channel = Channel.objects.filter(public_slug=raw).first()
            if channel:
                if channel.privacy == Channel.Privacy.PRIVATE:
                    return Response({"detail": "private_requires_invite"}, status=status.HTTP_403_FORBIDDEN)
                return perform_channel_join(request.user, channel, None)
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if PUBLIC_JOIN_CODE_RE.match(raw) and not UUID_TOKEN_RE.match(raw):
            channel = Channel.objects.filter(public_join_slug__iexact=raw.lower()).first()
            if channel:
                if channel.privacy == Channel.Privacy.PRIVATE:
                    return Response({"detail": "private_requires_invite"}, status=status.HTTP_403_FORBIDDEN)
                return perform_channel_join(request.user, channel, None)

        path = raw
        try:
            if re.match(r"^https?://", raw, re.I):
                path = urlparse(raw).path or ""
            elif not raw.startswith("/"):
                path = "/" + raw
        except Exception:
            path = raw

        m = re.search(r"/channel/(\d+)", path)
        if m:
            channel = Channel.objects.filter(id=int(m.group(1))).first()
            if not channel:
                return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            return perform_channel_join(request.user, channel, extra_token)

        m = re.search(r"/join/private/([0-9a-f-]{36})", path, re.I)
        if m:
            token_str = m.group(1)
            invite = InviteToken.objects.filter(token=token_str, is_active=True).select_related("channel").first()
            if not invite:
                return Response({"detail": "invite_invalid"}, status=status.HTTP_404_NOT_FOUND)
            return perform_channel_join(request.user, invite.channel, token_str)

        m = re.search(r"/join/public/([a-zA-Z0-9-]+)", path, re.I)
        if m:
            seg = m.group(1)
            channel = _resolve_public_join_segment(seg)
            if not channel:
                return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            if channel.privacy == Channel.Privacy.PRIVATE:
                return Response({"detail": "private_requires_invite"}, status=status.HTTP_403_FORBIDDEN)
            return perform_channel_join(request.user, channel, None)

        return Response({"detail": "unrecognized_link"}, status=status.HTTP_400_BAD_REQUEST)
