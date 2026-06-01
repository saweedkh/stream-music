"""User list for mentions/invites."""

from django.contrib.auth.models import User
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import user_badge_flags
from apps.social.services.avatar import avatar_url_for_user_id


class UsersListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        users = User.objects.exclude(id=request.user.id).order_by("username")[:100]
        return Response(
            {
                "results": [
                    {
                        "id": user.id,
                        "username": user.username,
                        "avatar_url": avatar_url_for_user_id(user.id, request=request),
                        **user_badge_flags(user),
                    }
                    for user in users
                ]
            }
        )
