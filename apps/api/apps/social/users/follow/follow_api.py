from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.social.models import UserFollow, UserPublicProfile


class UserFollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username: str):
        target = User.objects.filter(username__iexact=username).first()
        if target is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        row = UserFollow.objects.filter(follower_id=request.user.id, following_id=target.id).first()
        follower_count = UserFollow.objects.filter(following_id=target.id).count()
        return Response(
            {
                "following": row is not None,
                "follower_count": follower_count,
                "following_count": UserFollow.objects.filter(follower_id=target.id).count(),
            }
        )

    def post(self, request, username: str):
        target = get_object_or_404(User, username__iexact=username)
        if target.id == request.user.id:
            return Response({"detail": "cannot_follow_self"}, status=status.HTTP_400_BAD_REQUEST)
        profile, _ = UserPublicProfile.objects.get_or_create(user_id=target.id)
        if not profile.is_public:
            return Response({"detail": "profile_private"}, status=status.HTTP_403_FORBIDDEN)
        UserFollow.objects.get_or_create(follower_id=request.user.id, following_id=target.id)
        return Response({"following": True}, status=status.HTTP_201_CREATED)

    def delete(self, request, username: str):
        target = get_object_or_404(User, username__iexact=username)
        UserFollow.objects.filter(follower_id=request.user.id, following_id=target.id).delete()
        return Response({"following": False})
