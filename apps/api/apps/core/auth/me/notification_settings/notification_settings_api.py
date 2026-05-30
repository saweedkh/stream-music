"""Notification settings."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import UserNotificationSettings
from apps.core.auth.me.notification_settings.notification_settings_serializers import UserNotificationSettingsSerializer


class UserNotificationSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        return Response(UserNotificationSettingsSerializer(prefs).data)

    def patch(self, request):
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        ser = UserNotificationSettingsSerializer(prefs, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
