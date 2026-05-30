from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.social.services.following_feed import build_following_channels_feed


class FollowingChannelsFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_following_channels_feed(request))
