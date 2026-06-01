"""Web push test."""

from django.conf import settings as django_settings
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class WebPushTestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.core.services.webpush import send_web_push_to_user

        send_web_push_to_user(
            request.user.id,
            title="Stream Music test",
            body="Push notifications are working on this device.",
            url=getattr(django_settings, "FRONTEND_BASE_URL", "/").rstrip("/") + "/dashboard",
            tag="stream-test",
            category="moderation",
        )
        return Response({"detail": "sent"})
