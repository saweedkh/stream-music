import re

from django.contrib.auth.models import User
from rest_framework import serializers

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,30}$")

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
    avatar_url = serializers.SerializerMethodField()

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
            "avatar_url",
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

    def get_avatar_url(self, obj):
        from apps.social.services.avatar import avatar_url_for

        row = self._public_profile(obj)
        request = self.context.get("request")
        return avatar_url_for(row, request=request)

    def get_badges(self, obj):
        from apps.accounts.user_badges import badges_for_user

        return badges_for_user(obj)

    def get_is_premium(self, obj):
        from apps.accounts.badge_models import SLUG_PREMIUM
        from apps.accounts.user_badges import badges_for_user

        slugs = {b["slug"] for b in badges_for_user(obj)}
        return SLUG_PREMIUM in slugs


def normalize_username(value: str) -> str:
    return (value or "").strip()


def validate_username_value(value: str, *, exclude_user_id: int | None = None) -> str:
    username = normalize_username(value)
    if not USERNAME_PATTERN.match(username):
        raise serializers.ValidationError("username_invalid")
    qs = User.objects.filter(username__iexact=username)
    if exclude_user_id is not None:
        qs = qs.exclude(pk=exclude_user_id)
    if qs.exists():
        raise serializers.ValidationError("username_taken")
    return username


class AuthUserProfileUpdateSerializer(serializers.ModelSerializer):
    """Partial update for the signed-in user."""

    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name"]

    def validate_username(self, value: str) -> str:
        if self.instance and normalize_username(value) == self.instance.username:
            return self.instance.username
        return validate_username_value(value, exclude_user_id=self.instance.pk if self.instance else None)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)


