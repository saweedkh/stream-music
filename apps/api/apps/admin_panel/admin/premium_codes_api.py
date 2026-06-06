"""Admin: create premium invite codes."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models.premium_invite_code import PremiumInviteCode
from apps.admin_panel.admin.admin_api import SuperuserRequired


class AdminPremiumCodesView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        rows = PremiumInviteCode.objects.order_by("-created_at")[:100]
        return Response(
            {
                "results": [
                    {
                        "id": r.id,
                        "code": r.code,
                        "max_uses": r.max_uses,
                        "use_count": r.use_count,
                        "is_active": r.is_active,
                        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
                        "note": r.note,
                    }
                    for r in rows
                ]
            }
        )

    def post(self, request):
        max_uses = max(1, min(int(request.data.get("max_uses") or 1), 1000))
        days = request.data.get("expires_in_days")
        expires_at = None
        if days is not None:
            try:
                expires_at = timezone.now() + timedelta(days=int(days))
            except (TypeError, ValueError):
                pass
        row = PremiumInviteCode.objects.create(
            max_uses=max_uses,
            expires_at=expires_at,
            note=str(request.data.get("note") or "")[:255],
            created_by_id=request.user.id,
        )
        return Response(
            {"id": row.id, "code": row.code, "max_uses": row.max_uses, "expires_at": expires_at},
            status=status.HTTP_201_CREATED,
        )


class AdminPremiumCodeDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def patch(self, request, code_id: int):
        row = PremiumInviteCode.objects.filter(id=code_id).first()
        if row is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if "is_active" in request.data:
            row.is_active = bool(request.data["is_active"])
            row.save(update_fields=["is_active"])
        return Response(
            {
                "id": row.id,
                "code": row.code,
                "max_uses": row.max_uses,
                "use_count": row.use_count,
                "is_active": row.is_active,
                "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                "note": row.note,
            }
        )
