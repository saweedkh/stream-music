"""Password change."""

from django.contrib.auth import update_session_auth_hash
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.auth.me.password.password_serializers import PasswordChangeSerializer


class UserPasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = PasswordChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        current = ser.validated_data["current_password"]
        new_pw = ser.validated_data["new_password"]
        if not request.user.check_password(current):
            return Response({"detail": "wrong_password"}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_pw)
        request.user.save(update_fields=["password"])
        update_session_auth_hash(request, request.user)
        return Response({"detail": "ok"})
