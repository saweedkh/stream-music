"""Admin analytics endpoints."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_panel.admin.admin_api import SuperuserRequired
from apps.admin_panel.admin.admin_content_api import pagination_params
from apps.admin_panel.selectors.platform_analytics import (
    build_admin_channel_analytics_detail,
    build_platform_analytics_overview,
    list_channel_analytics,
    list_gamification_profiles,
)


class AdminAnalyticsOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        return Response(build_platform_analytics_overview())


class AdminAnalyticsChannelsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_channel_analytics(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminAnalyticsChannelDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request, channel_id: int):
        payload = build_admin_channel_analytics_detail(channel_id)
        if payload is None:
            return Response({"detail": "not_found"}, status=404)
        return Response(payload)


class AdminAnalyticsGamificationView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_gamification_profiles(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})
