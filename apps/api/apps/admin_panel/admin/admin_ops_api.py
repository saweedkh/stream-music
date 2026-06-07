"""Platform-wide operational admin endpoints (moderation queues, live sessions, etc.)."""

from __future__ import annotations

from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PremiumCodeRedemption
from apps.admin_panel.admin.admin_api import SuperuserRequired
from apps.admin_panel.admin.audit_helpers import log_admin_action
from apps.admin_panel.admin.admin_content_api import _paginate
from apps.channels.models import Channel, ChannelChatReport, ChannelJoinRequest, ChannelPlaylistSuggestion
from apps.playback.models import PlaybackSession
from apps.support.models import SupportTicket


class AdminModerationReportsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "open").strip().lower()
        qs = (
            ChannelChatReport.objects.select_related("channel", "message", "reporter")
            .order_by("-created_at")
        )
        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(channel__name__icontains=search)
                | Q(reporter__username__icontains=search)
                | Q(reason__icontains=search)
            )
        rows, total, offset, limit = _paginate(request, qs)
        results = []
        for report in rows:
            msg = report.message
            results.append(
                {
                    "id": report.id,
                    "channel_id": report.channel_id,
                    "channel_name": report.channel.name,
                    "message_id": report.message_id,
                    "message_preview": (msg.body or "")[:200] if msg else "",
                    "reporter_id": report.reporter_id,
                    "reporter_username": report.reporter.username,
                    "reason": report.reason,
                    "status": report.status,
                    "created_at": report.created_at.isoformat() if report.created_at else None,
                }
            )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminModerationReportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def patch(self, request, report_id: int):
        report = ChannelChatReport.objects.filter(id=report_id).first()
        if report is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if "status" in request.data:
            new_status = str(request.data["status"])
            if new_status in ChannelChatReport.Status.values:
                report.status = new_status
                report.save(update_fields=["status"])
                log_admin_action(
                    request,
                    "moderation_report.update",
                    "moderation_report",
                    report.id,
                    {"status": new_status, "channel_id": report.channel_id},
                )
        return Response(
            {
                "id": report.id,
                "status": report.status,
                "channel_id": report.channel_id,
            }
        )


class AdminJoinRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "pending").strip().lower()
        qs = ChannelJoinRequest.objects.select_related("channel", "user").order_by("-created_at")
        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(Q(channel__name__icontains=search) | Q(user__username__icontains=search))
        rows, total, offset, limit = _paginate(request, qs)
        results = [
            {
                "id": row.id,
                "channel_id": row.channel_id,
                "channel_name": row.channel.name,
                "user_id": row.user_id,
                "username": row.user.username,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminLiveSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = (
            PlaybackSession.objects.select_related("channel", "channel__owner", "track")
            .filter(is_playing=True)
            .order_by("-updated_at")
        )
        if search:
            qs = qs.filter(
                Q(channel__name__icontains=search)
                | Q(channel__owner__username__icontains=search)
                | Q(track__title__icontains=search)
            )
        rows, total, offset, limit = _paginate(request, qs)
        results = []
        for session in rows:
            ch = session.channel
            track = session.track
            results.append(
                {
                    "channel_id": ch.id,
                    "channel_name": ch.name,
                    "owner_username": ch.owner.username if ch.owner_id else None,
                    "privacy": ch.privacy,
                    "track_id": track.id if track else None,
                    "track_title": track.title if track else None,
                    "playback_rate": session.playback_rate,
                    "queue_version": session.queue_version,
                    "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                }
            )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminPremiumRedemptionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = PremiumCodeRedemption.objects.select_related("code", "user").order_by("-redeemed_at")
        if search:
            qs = qs.filter(Q(user__username__icontains=search) | Q(code__code__icontains=search))
        rows, total, offset, limit = _paginate(request, qs)
        results = [
            {
                "id": row.id,
                "code": row.code.code,
                "user_id": row.user_id,
                "username": row.user.username,
                "redeemed_at": row.redeemed_at.isoformat() if row.redeemed_at else None,
            }
            for row in rows
        ]
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


class AdminSuggestionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, SuperuserRequired]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "pending").strip().lower()
        qs = ChannelPlaylistSuggestion.objects.select_related("channel", "user", "track").order_by("-created_at")
        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(channel__name__icontains=search)
                | Q(user__username__icontains=search)
                | Q(external_title__icontains=search)
            )
        rows, total, offset, limit = _paginate(request, qs)
        results = []
        for row in rows:
            title = row.track.title if row.track_id else row.external_title
            results.append(
                {
                    "id": row.id,
                    "channel_id": row.channel_id,
                    "channel_name": row.channel.name,
                    "user_id": row.user_id,
                    "username": row.user.username,
                    "title": title or "—",
                    "status": row.status,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
            )
        return Response({"results": results, "total": total, "offset": offset, "limit": limit})


def support_ticket_stats() -> dict:
    open_statuses = [
        SupportTicket.Status.OPEN,
        SupportTicket.Status.IN_PROGRESS,
        SupportTicket.Status.WAITING_STAFF,
        SupportTicket.Status.WAITING_USER,
    ]
    return {
        "open": SupportTicket.objects.filter(status__in=open_statuses).count(),
        "waiting_staff": SupportTicket.objects.filter(status=SupportTicket.Status.WAITING_STAFF).count(),
        "urgent": SupportTicket.objects.filter(
            priority=SupportTicket.Priority.URGENT,
            status__in=open_statuses,
        ).count(),
    }


def ops_pending_counts() -> dict:
    return {
        "chat_reports_open": ChannelChatReport.objects.filter(status=ChannelChatReport.Status.OPEN).count(),
        "join_requests_pending": ChannelJoinRequest.objects.filter(
            status=ChannelJoinRequest.Status.PENDING
        ).count(),
        "suggestions_pending": ChannelPlaylistSuggestion.objects.filter(
            status=ChannelPlaylistSuggestion.Status.PENDING
        ).count(),
        "channels_playing": PlaybackSession.objects.filter(is_playing=True).count(),
        "support": support_ticket_stats(),
    }
