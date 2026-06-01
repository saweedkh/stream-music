"""Check whether a username is available for the signed-in user."""

from django.contrib.auth.models import User
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.auth.me.me_serializers import USERNAME_PATTERN, normalize_username


class UsernameAvailabilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        raw = normalize_username(request.query_params.get("username") or "")
        if not raw:
            return Response({"available": False, "reason": "required"})
        if raw == request.user.username:
            return Response({"available": True})
        if not USERNAME_PATTERN.match(raw):
            return Response({"available": False, "reason": "username_invalid"})
        if User.objects.filter(username__iexact=raw).exclude(pk=request.user.pk).exists():
            return Response({"available": False, "reason": "username_taken"})
        return Response({"available": True})
