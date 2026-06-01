"""Current user profile."""

from django.conf import settings as django_settings
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import UserNotificationSettings
from apps.core.auth.me.me_serializers import AuthUserProfileUpdateSerializer, AuthUserSerializer
from apps.core.auth.me.notification_settings.notification_settings_serializers import UserNotificationSettingsSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        body = {"user": AuthUserSerializer(request.user, context={"request": request}).data}
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        body["notification_settings"] = UserNotificationSettingsSerializer(prefs).data
        pub = (getattr(django_settings, "WEBPUSH_VAPID_PUBLIC_KEY", None) or "").strip()
        if pub:
            body["webpush"] = {"vapid_public_key": pub}
        return Response(body)

    def patch(self, request):
        ser = AuthUserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        body = {"user": AuthUserSerializer(request.user, context={"request": request}).data}
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        body["notification_settings"] = UserNotificationSettingsSerializer(prefs).data
        pub = (getattr(django_settings, "WEBPUSH_VAPID_PUBLIC_KEY", None) or "").strip()
        if pub:
            body["webpush"] = {"vapid_public_key": pub}
        return Response(body)
