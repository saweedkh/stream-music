"""Admin social graph endpoints."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_panel.admin.permissions import SuperuserRequired
from apps.admin_panel.admin.admin_content_api import pagination_params
from apps.admin_panel.selectors.platform_social import (
    build_social_overview,
    list_activity_events,
    list_channel_follows,
    list_public_profiles,
    list_referral_codes,
    list_user_follows,
)
from apps.admin_panel.services.audit_log import log_platform_admin_action
from apps.social.models import UserPublicProfile


class AdminSocialOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        return Response(build_social_overview())


class AdminSocialProfilesView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        is_public = (request.query_params.get("is_public") or "all").strip().lower()
        offset, limit = pagination_params(request)
        results, total = list_public_profiles(
            search=search, is_public=is_public, offset=offset, limit=limit
        )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminSocialProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def patch(self, request, user_id: int):
        profile = UserPublicProfile.objects.filter(user_id=user_id).select_related("user").first()
        if profile is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        before = {"is_public": profile.is_public, "bio": profile.bio}
        update_fields: list[str] = []
        if "is_public" in request.data:
            profile.is_public = bool(request.data["is_public"])
            update_fields.append("is_public")
        if "bio" in request.data:
            profile.bio = str(request.data["bio"]).strip()[:500]
            update_fields.append("bio")
        if update_fields:
            profile.save(update_fields=[*update_fields, "updated_at"])
        log_platform_admin_action(
            actor_id=request.user.id,
            action="profile.update",
            target_type="user_profile",
            target_id=user_id,
            metadata={"before": before, "after": {"is_public": profile.is_public, "bio": profile.bio}},
        )
        return Response(
            {
                "user_id": profile.user_id,
                "username": profile.user.username,
                "bio": profile.bio,
                "is_public": profile.is_public,
            }
        )


class AdminSocialChannelFollowsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_channel_follows(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminSocialUserFollowsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_user_follows(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminSocialReferralsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        offset, limit = pagination_params(request)
        results, total = list_referral_codes(search=search, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminSocialActivityView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        kind = (request.query_params.get("kind") or "all").strip()
        offset, limit = pagination_params(request)
        results, total = list_activity_events(search=search, kind=kind, offset=offset, limit=limit)
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})
