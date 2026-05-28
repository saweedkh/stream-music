from rest_framework import serializers
from django.contrib.auth.models import User

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
class AuthUserSerializer(serializers.ModelSerializer):
    date_joined = serializers.DateTimeField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)
    badges = serializers.SerializerMethodField()
    is_premium = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    is_public = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "is_premium",
            "badges",
            "date_joined",
            "bio",
            "is_public",
        ]

    def _public_profile(self, obj):
        from apps.social.models import UserPublicProfile

        return UserPublicProfile.objects.filter(user_id=obj.id).first()

    def get_bio(self, obj):
        row = self._public_profile(obj)
        return row.bio if row else ""

    def get_is_public(self, obj):
        row = self._public_profile(obj)
        return bool(row.is_public) if row else False

    def get_badges(self, obj):
        from apps.accounts.user_badges import badges_for_user

        return badges_for_user(obj)

    def get_is_premium(self, obj):
        from apps.accounts.badge_models import SLUG_PREMIUM
        from apps.accounts.user_badges import badges_for_user

        slugs = {b["slug"] for b in badges_for_user(obj)}
        return SLUG_PREMIUM in slugs


class AuthUserProfileUpdateSerializer(serializers.ModelSerializer):
    """Partial update for the signed-in user (username is immutable here)."""

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name"]


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)


