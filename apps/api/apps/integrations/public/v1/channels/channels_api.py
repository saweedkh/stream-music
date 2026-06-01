"""Token-authenticated read-only channel API."""

from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel
from apps.integrations.services.api_tokens import user_from_bearer_token
from apps.playback.models import PlaybackSession


class PublicChannelsListView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        user = user_from_bearer_token(request.headers.get("Authorization"))
        if user is None:
            return Response({"detail": "invalid_token"}, status=401)
        rows = Channel.objects.filter(is_active=True).select_related("owner")[:100]
        out = []
        for ch in rows:
            sess = PlaybackSession.objects.filter(channel_id=ch.id).first()
            out.append(
                {
                    "id": ch.id,
                    "name": ch.name,
                    "owner": ch.owner.username if ch.owner_id else None,
                    "is_playing": bool(sess and sess.is_playing),
                    "privacy": ch.privacy,
                }
            )
        return Response({"results": out})
