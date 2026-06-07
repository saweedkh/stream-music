"""Admin integrations endpoints."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_panel.admin.admin_api import SuperuserRequired
from apps.admin_panel.admin.admin_content_api import pagination_params
from apps.admin_panel.admin.audit_helpers import log_admin_action
from apps.admin_panel.selectors.platform_integrations import (
    build_integrations_overview,
    export_webhook_deliveries,
    list_api_tokens,
    list_webhook_deliveries,
    list_webhook_subscriptions,
)
from apps.admin_panel.services.csv_response import admin_csv_response
from apps.integrations.models import WebhookSubscription


def _date_params(request) -> tuple[str, str]:
    return (
        (request.query_params.get("date_from") or "").strip(),
        (request.query_params.get("date_to") or "").strip(),
    )


class AdminIntegrationsOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        return Response(build_integrations_overview())


class AdminIntegrationsWebhooksView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_webhook_subscriptions(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminIntegrationsWebhookDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def patch(self, request, webhook_id: int):
        row = WebhookSubscription.objects.filter(id=webhook_id).first()
        if row is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        before = row.is_active
        if "is_active" in request.data:
            row.is_active = bool(request.data["is_active"])
            row.save(update_fields=["is_active"])
        log_admin_action(
            request,
            "webhook.update",
            "webhook_subscription",
            row.id,
            {"before": {"is_active": before}, "after": {"is_active": row.is_active}},
        )
        return Response({"id": row.id, "is_active": row.is_active})


class AdminIntegrationsDeliveriesView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        date_from, date_to = _date_params(request)
        offset, limit = pagination_params(request)
        results, total = list_webhook_deliveries(
            search=search,
            date_from=date_from,
            date_to=date_to,
            offset=offset,
            limit=limit,
        )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminIntegrationsDeliveriesExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        date_from, date_to = _date_params(request)
        rows = export_webhook_deliveries(search=search, date_from=date_from, date_to=date_to)
        return admin_csv_response(
            filename="webhook-deliveries.csv",
            headers=["id", "subscription_id", "owner", "url", "event", "status_code", "success", "created_at"],
            rows=rows,
        )


class AdminIntegrationsApiTokensView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_api_tokens(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})
