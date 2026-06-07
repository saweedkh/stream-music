"""User registration."""

from django.contrib.auth import login
from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.auth.me.me_serializers import AuthUserSerializer
from apps.social.services.referral import ReferralApplyError, apply_referral_on_signup


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        email = (request.data.get("email") or "").strip()
        referral_code = request.data.get("referral_code") or request.data.get("ref")
        if not username or not password:
            return Response({"detail": "username_and_password_required"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "username_taken"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, email=email, password=password)
        referral_result = None
        if referral_code:
            try:
                referral_result = apply_referral_on_signup(user_id=user.id, raw_code=str(referral_code))
            except ReferralApplyError as exc:
                user.delete()
                return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        payload = {"user": AuthUserSerializer(user, context={"request": request}).data}
        if referral_result:
            payload["referral"] = referral_result
        return Response(payload, status=status.HTTP_201_CREATED)
