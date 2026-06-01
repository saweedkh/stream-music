"""Personal API tokens for public read API."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.integrations.models import UserApiToken
from apps.integrations.services.api_tokens import create_api_token


class MeApiTokensView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = UserApiToken.objects.filter(user_id=request.user.id).order_by("-id")[:20]
        return Response(
            {
                "results": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "prefix": r.token_prefix,
                        "scopes": r.scopes,
                        "is_active": r.is_active,
                        "created_at": r.created_at.isoformat(),
                    }
                    for r in rows
                ]
            }
        )

    def post(self, request):
        name = str(request.data.get("name") or "token").strip()[:120]
        scopes = request.data.get("scopes")
        if not isinstance(scopes, list):
            scopes = ["read:channels"]
        row, raw = create_api_token(request.user.id, name, scopes)
        return Response(
            {"id": row.id, "name": row.name, "token": raw, "prefix": row.token_prefix},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request):
        tid = request.data.get("id")
        if not tid:
            return Response({"detail": "id_required"}, status=status.HTTP_400_BAD_REQUEST)
        UserApiToken.objects.filter(id=int(tid), user_id=request.user.id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
