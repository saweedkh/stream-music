"""Premium limits."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel


class PremiumLimitsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.premium_limits import user_has_premium

        owned = Channel.objects.filter(owner_id=request.user.id).count()
        premium = user_has_premium(request.user)
        return Response(
            {
                "is_premium": premium,
                "owned_channels": owned,
                "max_owned_channels": 50 if premium else 5,
                "max_member_limit": 200 if premium else 50,
                "premium_queue_boost": premium,
            }
        )
