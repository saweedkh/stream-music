"""User webhook subscriptions."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.integrations.models import WebhookSubscription


class MeWebhooksView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = WebhookSubscription.objects.filter(owner_id=request.user.id).order_by("-id")[:50]
        return Response(
            {
                "results": [
                    {
                        "id": r.id,
                        "url": r.url,
                        "events": r.events,
                        "is_active": r.is_active,
                        "last_delivery_at": r.last_delivery_at.isoformat() if r.last_delivery_at else None,
                        "last_error": r.last_error,
                    }
                    for r in rows
                ]
            }
        )

    def post(self, request):
        url = str(request.data.get("url") or "").strip()
        events = request.data.get("events")
        if not url:
            return Response({"detail": "url_required"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(events, list) or not events:
            events = [WebhookSubscription.Event.CHANNEL_LIVE]
        row = WebhookSubscription.objects.create(
            owner_id=request.user.id,
            url=url[:500],
            events=[str(e) for e in events][:10],
        )
        return Response(
            {"id": row.id, "url": row.url, "events": row.events, "secret": row.secret},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request):
        wid = request.data.get("id")
        if not wid:
            return Response({"detail": "id_required"}, status=status.HTTP_400_BAD_REQUEST)
        WebhookSubscription.objects.filter(id=int(wid), owner_id=request.user.id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
