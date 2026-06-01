"""Create Stripe Checkout session for premium."""

from __future__ import annotations

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.stripe_premium import StripePremiumError, create_premium_checkout_session, stripe_configured


class PremiumCheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not stripe_configured():
            return Response({"detail": "stripe_not_configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
        success = str(request.data.get("success_url") or f"{base}/dashboard?tab=settings&section=overview&premium=success")
        cancel = str(request.data.get("cancel_url") or f"{base}/dashboard?tab=settings&section=overview&premium=cancel")
        try:
            payload = create_premium_checkout_session(
                request.user.id,
                username=request.user.username,
                success_url=success,
                cancel_url=cancel,
            )
        except StripePremiumError as exc:
            return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)
