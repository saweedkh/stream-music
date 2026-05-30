"""CSRF cookie endpoint."""

from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@ensure_csrf_cookie
def auth_csrf(request):
    return Response({"detail": "csrf_cookie_set", "csrfToken": get_token(request)})
