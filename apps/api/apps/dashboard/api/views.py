"""Dashboard aggregation APIs."""

from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelMembership, ChannelPlaylistSuggestion
from apps.common.serializers import ChannelSerializer
from apps.channels.api.helpers import _can_manage_channel
from apps.playback.consumers import _presence_snapshot


class MeChannelsOnlineView(APIView):
    """Online listeners across channels the user owns or is an active member of."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        channel_ids = list(
            Channel.objects.filter(
                Q(owner_id=user.id) | Q(memberships__user_id=user.id, memberships__is_active=True),
                is_active=True,
            )
            .distinct()
            .values_list("id", flat=True)[:40]
        )
        channels = Channel.objects.filter(id__in=channel_ids).select_related("owner").order_by("-updated_at")
        pending_by_channel: dict[int, int] = {}
        managed_ids = [cid for cid in channel_ids if _can_manage_channel(user, cid)]
        if managed_ids:
            for row in (
                ChannelPlaylistSuggestion.objects.filter(
                    channel_id__in=managed_ids,
                    status=ChannelPlaylistSuggestion.Status.PENDING,
                )
                .values("channel_id")
                .annotate(n=Count("id"))
            ):
                pending_by_channel[row["channel_id"]] = row["n"]
        results = []
        total_online = 0
        for ch in channels:
            members, count = _presence_snapshot(ch.id)
            if count <= 0:
                continue
            total_online += count
            results.append(
                {
                    "channel": ChannelSerializer(ch, context={"request": request}).data,
                    "online_count": count,
                    "members": members[:12],
                    "pending_suggestions": pending_by_channel.get(ch.id, 0),
                }
            )
        results.sort(key=lambda r: -r["online_count"])
        return Response({"total_online": total_online, "results": results[:20]})


class MeChannelsPendingSuggestionsView(APIView):
    """Pending suggestion counts for channels the user can manage."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        channel_ids = list(
            Channel.objects.filter(
                Q(owner_id=user.id)
                | Q(
                    memberships__user_id=user.id,
                    memberships__is_active=True,
                    memberships__role__in=[
                        ChannelMembership.Role.OWNER,
                        ChannelMembership.Role.MODERATOR,
                    ],
                ),
                is_active=True,
            )
            .distinct()
            .values_list("id", flat=True)[:60]
        )
        rows = []
        if channel_ids:
            for row in (
                ChannelPlaylistSuggestion.objects.filter(
                    channel_id__in=channel_ids,
                    status=ChannelPlaylistSuggestion.Status.PENDING,
                )
                .values("channel_id")
                .annotate(pending_count=Count("id"))
            ):
                if row["pending_count"] > 0:
                    rows.append(
                        {
                            "channel_id": row["channel_id"],
                            "pending_count": row["pending_count"],
                        }
                    )
        return Response({"results": rows})
