"""Stripe webhook (no session auth)."""

from __future__ import annotations

from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.stripe_premium import StripePremiumError, handle_stripe_webhook_payload


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        try:
            result = handle_stripe_webhook_payload(
                request.body,
                request.META.get("HTTP_STRIPE_SIGNATURE"),
            )
        except StripePremiumError as exc:
            if exc.code == "invalid_signature":
                return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": exc.code}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result)
