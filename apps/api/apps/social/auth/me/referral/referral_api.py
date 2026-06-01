"""User referral code and stats."""

from __future__ import annotations

import secrets

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.social.models import ReferralCode


class MeReferralView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        row, _ = ReferralCode.objects.get_or_create(
            user_id=request.user.id,
            defaults={"code": secrets.token_urlsafe(8)[:12].upper()},
        )
        return Response({"code": row.code, "signup_count": row.signup_count})
