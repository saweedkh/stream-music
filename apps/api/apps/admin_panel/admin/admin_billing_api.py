"""Admin billing and premium endpoints."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_panel.admin.permissions import SuperuserRequired
from apps.admin_panel.admin.admin_content_api import pagination_params
from apps.admin_panel.selectors.platform_billing import (
    build_billing_overview,
    export_referral_signups,
    export_stripe_purchases,
    list_premium_users,
    list_referral_signups,
    list_stripe_purchases,
)
from apps.admin_panel.services.csv_response import admin_csv_response


def _date_params(request) -> tuple[str, str]:
    return (
        (request.query_params.get("date_from") or "").strip(),
        (request.query_params.get("date_to") or "").strip(),
    )


class AdminBillingOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        date_from, date_to = _date_params(request)
        return Response(build_billing_overview(date_from=date_from, date_to=date_to))


class AdminBillingStripePurchasesView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        date_from, date_to = _date_params(request)
        offset, limit = pagination_params(request)
        results, total = list_stripe_purchases(
            search=search,
            date_from=date_from,
            date_to=date_to,
            offset=offset,
            limit=limit,
        )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminBillingStripePurchasesExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        date_from, date_to = _date_params(request)
        rows = export_stripe_purchases(search=search, date_from=date_from, date_to=date_to)
        return admin_csv_response(
            filename="stripe-purchases.csv",
            headers=["id", "user_id", "username", "stripe_session_id", "amount_total", "currency", "created_at"],
            rows=rows,
        )


class AdminBillingPremiumUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_premium_users(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminBillingReferralSignupsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        date_from, date_to = _date_params(request)
        offset, limit = pagination_params(request)
        results, total = list_referral_signups(
            search=search,
            date_from=date_from,
            date_to=date_to,
            offset=offset,
            limit=limit,
        )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminBillingReferralSignupsExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        date_from, date_to = _date_params(request)
        rows = export_referral_signups(search=search, date_from=date_from, date_to=date_to)
        return admin_csv_response(
            filename="referral-signups.csv",
            headers=[
                "id",
                "code",
                "referrer_id",
                "referrer_username",
                "referred_user_id",
                "referred_username",
                "created_at",
            ],
            rows=rows,
        )
