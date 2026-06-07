"""In-app admin API for platform superusers."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Count, Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import COLOR_CHOICES, ICON_CHOICES, UserBadgeAssignment, UserBadgeDefinition
from apps.accounts.user_badges import (
    MANUAL_EXCLUDED_SLUGS,
    SLUG_PREMIUM,
    badges_for_users,
    is_platform_superuser,
    serialize_badge,
    set_user_manual_badges,
    user_badge_flags,
)
from apps.admin_panel.admin.permissions import SuperuserRequired
from apps.admin_panel.selectors.platform_ops import ops_pending_counts
from apps.admin_panel.admin.audit_helpers import log_admin_action
from apps.channels.models import Channel, ChannelMembership
from apps.playback.models import PlaybackSession
from apps.playlists.models import Playlist
from apps.tracks.models import Track


class AdminOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        users_total = User.objects.count()
        users_active = User.objects.filter(is_active=True).count()
        users_staff = User.objects.filter(is_staff=True).count()
        users_super = User.objects.filter(is_superuser=True).count()
        channels_total = Channel.objects.count()
        channels_active = Channel.objects.filter(is_active=True).count()
        channels_playing = PlaybackSession.objects.filter(is_playing=True).count()
        tracks_total = Track.objects.count()
        playlists_total = Playlist.objects.count()
        memberships_active = ChannelMembership.objects.filter(is_active=True).count()
        pending = ops_pending_counts()
        return Response(
            {
                "users": {
                    "total": users_total,
                    "active": users_active,
                    "staff": users_staff,
                    "superuser": users_super,
                },
                "channels": {
                    "total": channels_total,
                    "active": channels_active,
                    "playing": channels_playing,
                },
                "tracks_total": tracks_total,
                "playlists_total": playlists_total,
                "memberships_active": memberships_active,
                "pending": pending,
            }
        )


class AdminUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = User.objects.all().order_by("-date_joined", "id")
        if search:
            qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search))
        try:
            limit = max(1, min(int(request.query_params.get("limit", "50")), 200))
        except (TypeError, ValueError):
            limit = 50
        try:
            offset = max(0, int(request.query_params.get("offset", "0")))
        except (TypeError, ValueError):
            offset = 0
        total = qs.count()
        rows = list(qs[offset : offset + limit])
        badge_map = badges_for_users(rows)
        results = []
        for u in rows:
            flags = user_badge_flags(u)
            results.append(
                {
                    "id": u.id,
                    "username": u.username,
                    "email": u.email or "",
                    "first_name": u.first_name or "",
                    "last_name": u.last_name or "",
                    "is_active": u.is_active,
                    "is_staff": u.is_staff,
                    "is_superuser": u.is_superuser,
                    "date_joined": u.date_joined.isoformat() if u.date_joined else None,
                    "last_login": u.last_login.isoformat() if u.last_login else None,
                    "badges": badge_map.get(u.id, flags.get("badges", [])),
                    "is_premium": flags.get("is_premium", False),
                }
            )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request, user_id: int):
        target = User.objects.filter(id=user_id).first()
        if target is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        flags = user_badge_flags(target)
        owned_channels = Channel.objects.filter(owner_id=target.id).count()
        tracks_owned = Track.objects.filter(owner_id=target.id).count()
        playlists_owned = Playlist.objects.filter(owner_id=target.id).count()
        memberships = ChannelMembership.objects.filter(user_id=target.id, is_active=True).count()
        return Response(
            {
                "id": target.id,
                "username": target.username,
                "email": target.email or "",
                "first_name": target.first_name or "",
                "last_name": target.last_name or "",
                "is_active": target.is_active,
                "is_staff": target.is_staff,
                "is_superuser": target.is_superuser,
                "date_joined": target.date_joined.isoformat() if target.date_joined else None,
                "last_login": target.last_login.isoformat() if target.last_login else None,
                "owned_channels": owned_channels,
                "tracks_owned": tracks_owned,
                "playlists_owned": playlists_owned,
                "memberships": memberships,
                **flags,
            }
        )

    def patch(self, request, user_id: int):
        target = User.objects.filter(id=user_id).first()
        if target is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if target.id == request.user.id and request.data.get("is_superuser") is False:
            return Response({"detail": "cannot_demote_self"}, status=status.HTTP_400_BAD_REQUEST)
        if target.id == request.user.id and request.data.get("is_active") is False:
            return Response({"detail": "cannot_deactivate_self"}, status=status.HTTP_400_BAD_REQUEST)

        update_fields: list[str] = []
        if "is_active" in request.data:
            target.is_active = bool(request.data["is_active"])
            update_fields.append("is_active")
        if "is_staff" in request.data:
            target.is_staff = bool(request.data["is_staff"])
            update_fields.append("is_staff")
        if "is_superuser" in request.data:
            target.is_superuser = bool(request.data["is_superuser"])
            if target.is_superuser:
                target.is_staff = True
                if "is_staff" not in update_fields:
                    update_fields.append("is_staff")
            update_fields.append("is_superuser")

        if update_fields:
            target.save(update_fields=list(dict.fromkeys(update_fields)))

        if "badge_slugs" in request.data:
            slugs = request.data.get("badge_slugs")
            if not isinstance(slugs, list):
                return Response(
                    {"detail": "badge_slugs_must_be_list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            set_user_manual_badges(target.id, slugs, assigned_by_id=request.user.id)

        if "is_premium" in request.data:
            manual_slugs = list(
                UserBadgeAssignment.objects.filter(user_id=target.id)
                .exclude(badge__slug__in=MANUAL_EXCLUDED_SLUGS)
                .values_list("badge__slug", flat=True)
            )
            want_premium = bool(request.data["is_premium"])
            if want_premium and SLUG_PREMIUM not in manual_slugs:
                manual_slugs.append(SLUG_PREMIUM)
            elif not want_premium:
                manual_slugs = [s for s in manual_slugs if s != SLUG_PREMIUM]
            set_user_manual_badges(target.id, manual_slugs, assigned_by_id=request.user.id)

        if update_fields or "badge_slugs" in request.data or "is_premium" in request.data:
            log_admin_action(
                request,
                "user.update",
                "user",
                target.id,
                {"fields": list(request.data.keys())},
            )

        return Response(
            {
                "id": target.id,
                "username": target.username,
                "email": target.email or "",
                "is_active": target.is_active,
                "is_staff": target.is_staff,
                "is_superuser": target.is_superuser,
                **user_badge_flags(target),
            }
        )


def _badge_definition_payload(defn: UserBadgeDefinition) -> dict:
    return serialize_badge(defn) | {
        "description": defn.description,
        "is_active": defn.is_active,
        "is_system": defn.is_system,
        "id": defn.id,
    }


class AdminBadgesView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        rows = UserBadgeDefinition.objects.all().order_by("priority", "slug")
        return Response({"results": [_badge_definition_payload(b) for b in rows]})

    def post(self, request):
        slug = str(request.data.get("slug", "")).strip().lower()
        label = str(request.data.get("label", "")).strip()
        if not slug or not label:
            return Response(
                {"detail": "slug_and_label_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if UserBadgeDefinition.objects.filter(slug=slug).exists():
            return Response({"detail": "slug_exists"}, status=status.HTTP_400_BAD_REQUEST)
        icon = str(request.data.get("icon", "badge-check"))
        color = str(request.data.get("color", "sky"))
        if icon not in dict(ICON_CHOICES):
            icon = "badge-check"
        if color not in dict(COLOR_CHOICES):
            color = "sky"
        try:
            priority = int(request.data.get("priority", 100))
        except (TypeError, ValueError):
            priority = 100
        defn = UserBadgeDefinition.objects.create(
            slug=slug,
            label=label,
            description=str(request.data.get("description", "")).strip()[:255],
            icon=icon,
            color=color,
            priority=max(0, min(priority, 9999)),
            is_system=False,
            is_active=bool(request.data.get("is_active", True)),
        )
        return Response(_badge_definition_payload(defn), status=status.HTTP_201_CREATED)


class AdminBadgeDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def patch(self, request, badge_id: int):
        defn = UserBadgeDefinition.objects.filter(id=badge_id).first()
        if defn is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        update_fields: list[str] = []
        if "label" in request.data:
            label = str(request.data["label"]).strip()
            if label:
                defn.label = label
                update_fields.append("label")
        if "description" in request.data:
            defn.description = str(request.data["description"]).strip()[:255]
            update_fields.append("description")
        if "icon" in request.data:
            icon = str(request.data["icon"])
            if icon in dict(ICON_CHOICES):
                defn.icon = icon
                update_fields.append("icon")
        if "color" in request.data:
            color = str(request.data["color"])
            if color in dict(COLOR_CHOICES):
                defn.color = color
                update_fields.append("color")
        if "priority" in request.data:
            try:
                defn.priority = max(0, min(int(request.data["priority"]), 9999))
                update_fields.append("priority")
            except (TypeError, ValueError):
                pass
        if "is_active" in request.data:
            defn.is_active = bool(request.data["is_active"])
            update_fields.append("is_active")
        if update_fields:
            defn.save(update_fields=list(dict.fromkeys([*update_fields, "updated_at"])))
        return Response(_badge_definition_payload(defn))

    def delete(self, request, badge_id: int):
        defn = UserBadgeDefinition.objects.filter(id=badge_id).first()
        if defn is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if defn.is_system:
            return Response(
                {"detail": "cannot_delete_system_badge"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        defn.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminChannelsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = (
            Channel.objects.select_related("owner", "playback_session")
            .annotate(member_count=Count("memberships", filter=Q(memberships__is_active=True)))
            .order_by("-id")
        )
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(owner__username__icontains=search))
        try:
            limit = max(1, min(int(request.query_params.get("limit", "50")), 200))
        except (TypeError, ValueError):
            limit = 50
        try:
            offset = max(0, int(request.query_params.get("offset", "0")))
        except (TypeError, ValueError):
            offset = 0
        total = qs.count()
        results = []
        for ch in qs[offset : offset + limit]:
            results.append(
                {
                    "id": ch.id,
                    "name": ch.name,
                    "privacy": ch.privacy,
                    "owner_id": ch.owner_id,
                    "owner_username": ch.owner.username if ch.owner_id else None,
                    "is_active": ch.is_active,
                    "member_count": ch.member_count,
                    "is_playing": bool(getattr(ch, "playback_session", None) and ch.playback_session.is_playing),
                }
            )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminChannelDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request, channel_id: int):
        channel = (
            Channel.objects.select_related("owner")
            .annotate(member_count=Count("memberships", filter=Q(memberships__is_active=True)))
            .filter(id=channel_id)
            .first()
        )
        if channel is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        playing = PlaybackSession.objects.filter(channel_id=channel.id, is_playing=True).exists()
        return Response(
            {
                "id": channel.id,
                "name": channel.name,
                "description": channel.description or "",
                "privacy": channel.privacy,
                "owner_id": channel.owner_id,
                "owner_username": channel.owner.username if channel.owner_id else None,
                "member_limit": channel.member_limit,
                "join_requires_approval": channel.join_requires_approval,
                "is_active": channel.is_active,
                "member_count": channel.member_count,
                "is_playing": playing,
                "created_at": channel.created_at.isoformat() if channel.created_at else None,
            }
        )

    def patch(self, request, channel_id: int):
        channel = Channel.objects.filter(id=channel_id).first()
        if channel is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        update_fields: list[str] = []
        if "is_active" in request.data:
            channel.is_active = bool(request.data["is_active"])
            update_fields.append("is_active")
        if "privacy" in request.data:
            privacy = str(request.data["privacy"])
            if privacy in Channel.Privacy.values:
                channel.privacy = privacy
                update_fields.append("privacy")
        if "name" in request.data:
            name = str(request.data["name"]).strip()
            if name:
                channel.name = name[:255]
                update_fields.append("name")
        if "description" in request.data:
            channel.description = str(request.data["description"]).strip()
            update_fields.append("description")
        if "member_limit" in request.data:
            try:
                channel.member_limit = max(1, min(int(request.data["member_limit"]), 500))
                update_fields.append("member_limit")
            except (TypeError, ValueError):
                pass
        if "join_requires_approval" in request.data:
            channel.join_requires_approval = bool(request.data["join_requires_approval"])
            update_fields.append("join_requires_approval")
        if update_fields:
            channel.save(update_fields=update_fields)
            log_admin_action(request, "channel.update", "channel", channel.id, {"fields": update_fields})
        playing = PlaybackSession.objects.filter(channel_id=channel.id, is_playing=True).exists()
        return Response(
            {
                "id": channel.id,
                "name": channel.name,
                "description": channel.description or "",
                "privacy": channel.privacy,
                "member_limit": channel.member_limit,
                "join_requires_approval": channel.join_requires_approval,
                "is_active": channel.is_active,
                "is_playing": playing,
            }
        )


class AdminHealthView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        from apps.admin_panel.services.system_metrics import build_admin_system_payload

        return Response(build_admin_system_payload())


class AdminTrackImportsView(APIView):
    """Recent URL/streaming imports for admin audit."""

    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = Track.objects.exclude(import_source="").select_related("owner").order_by("-created_at")
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(source_url__icontains=search)
                | Q(owner__username__icontains=search)
            )
        try:
            limit = max(1, min(int(request.query_params.get("limit", "50")), 200))
        except (TypeError, ValueError):
            limit = 50
        try:
            offset = max(0, int(request.query_params.get("offset", "0")))
        except (TypeError, ValueError):
            offset = 0
        total = qs.count()
        results = []
        for track in qs[offset : offset + limit]:
            results.append(
                {
                    "id": track.id,
                    "title": track.title,
                    "owner_id": track.owner_id,
                    "owner_username": track.owner.username,
                    "import_source": track.import_source,
                    "source_url": track.source_url,
                    "visibility": track.visibility,
                    "created_at": track.created_at.isoformat() if track.created_at else None,
                }
            )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})
