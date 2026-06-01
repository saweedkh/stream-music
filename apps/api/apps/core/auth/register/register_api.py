"""User registration."""

from django.contrib.auth import login
from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.auth.me.me_serializers import AuthUserSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        email = (request.data.get("email") or "").strip()
        if not username or not password:
            return Response({"detail": "username_and_password_required"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "username_taken"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, email=email, password=password)
        login(request, user)
        return Response(
            {"user": AuthUserSerializer(user, context={"request": request}).data},
            status=status.HTTP_201_CREATED,
        )
