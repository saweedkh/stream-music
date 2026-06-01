"""Web push subscription."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import WebPushSubscription


class WebPushSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ep = request.data.get("endpoint")
        keys = request.data.get("keys") if isinstance(request.data.get("keys"), dict) else {}
        p256dh = keys.get("p256dh") if isinstance(keys, dict) else None
        auth = keys.get("auth") if isinstance(keys, dict) else None
        if not ep or not p256dh or not auth:
            return Response({"detail": "invalid_subscription"}, status=status.HTTP_400_BAD_REQUEST)
        WebPushSubscription.objects.update_or_create(
            endpoint=str(ep),
            defaults={
                "user_id": request.user.id,
                "p256dh": str(p256dh)[:255],
                "auth": str(auth)[:255],
            },
        )
        return Response({"detail": "ok"})

    def delete(self, request):
        ep = request.data.get("endpoint") if isinstance(request.data, dict) else None
        qs = WebPushSubscription.objects.filter(user_id=request.user.id)
        if ep:
            qs = qs.filter(endpoint=str(ep))
        deleted, _ = qs.delete()
        return Response({"deleted": deleted})
