"""POST redeem premium invite code."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.premium_redeem import PremiumRedeemError, redeem_premium_code


class PremiumRedeemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get("code")
        try:
            payload = redeem_premium_code(request.user.id, str(code or ""))
        except PremiumRedeemError as exc:
            return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)
