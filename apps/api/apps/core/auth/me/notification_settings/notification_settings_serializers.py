from rest_framework import serializers

from apps.channels.models import UserNotificationSettings


class UserNotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserNotificationSettings
        fields = [
            "chat_notify",
            "admin_notify_reactions",
            "admin_notify_votes",
            "push_quiet_hours_start",
            "push_quiet_hours_end",
            "push_category_playback",
            "push_category_chat",
            "push_category_moderation",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
