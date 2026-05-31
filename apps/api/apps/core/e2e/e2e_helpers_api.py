"""E2E-only helpers (disabled unless E2E_RATE_LIMIT_OFF)."""

from __future__ import annotations

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models.premium_invite_code import PremiumInviteCode


class E2EPremiumCodeView(APIView):
    """Create a one-off premium invite code for Playwright UI tests."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not getattr(settings, "E2E_RATE_LIMIT_OFF", False):
            return Response({"detail": "not_available"}, status=status.HTTP_404_NOT_FOUND)
        row = PremiumInviteCode.objects.create(max_uses=50, note="e2e")
        return Response({"code": row.code})
