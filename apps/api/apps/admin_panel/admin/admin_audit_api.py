"""Platform admin audit log API."""

from __future__ import annotations

from django.db.models import Q
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_panel.admin.permissions import SuperuserRequired
from apps.admin_panel.admin.admin_content_api import _paginate
from apps.admin_panel.models import PlatformAdminAuditLog


class AdminAuditLogView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        action = (request.query_params.get("action") or "").strip()
        target_type = (request.query_params.get("target_type") or "").strip()
        qs = PlatformAdminAuditLog.objects.select_related("actor").order_by("-created_at")
        if action:
            qs = qs.filter(action=action)
        if target_type:
            qs = qs.filter(target_type=target_type)
        if search:
            qs = qs.filter(
                Q(action__icontains=search)
                | Q(target_type__icontains=search)
                | Q(target_id__icontains=search)
                | Q(actor__username__icontains=search)
            )
        rows, total, offset, limit = _paginate(request, qs)
        results = [
            {
                "id": row.id,
                "actor_id": row.actor_id,
                "actor_username": row.actor.username if row.actor_id else None,
                "action": row.action,
                "target_type": row.target_type,
                "target_id": row.target_id,
                "metadata": row.metadata,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})
