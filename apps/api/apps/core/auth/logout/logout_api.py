"""User logout."""

from django.contrib.auth import logout
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"detail": "logged_out"})
