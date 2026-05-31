"""Channel chat moderation API."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelChatMessage, ChannelChatReport
from apps.channels.moderation import ban_user, is_channel_staff, unban_user
from apps.channels.api.helpers import _can_manage_channel


class ChannelChatReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not Channel.objects.filter(id=channel_id).exists():
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        message_id = request.data.get("message_id")
        try:
            mid = int(message_id)
        except (TypeError, ValueError):
            return Response({"detail": "invalid_message"}, status=status.HTTP_400_BAD_REQUEST)
        msg = ChannelChatMessage.objects.filter(id=mid, channel_id=channel_id).first()
        if msg is None or msg.deleted_at:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if msg.user_id == request.user.id:
            return Response({"detail": "cannot_report_own"}, status=status.HTTP_400_BAD_REQUEST)
        reason = str(request.data.get("reason") or "")[:500]
        report, created = ChannelChatReport.objects.get_or_create(
            channel_id=channel_id,
            message_id=mid,
            reporter=request.user,
            defaults={"reason": reason},
        )
        if not created and reason:
            report.reason = reason
            report.save(update_fields=["reason"])
        return Response(
            {"id": report.id, "status": report.status, "created": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ChannelModerationReportsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_channel_staff(channel_id, request.user.id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        rows = (
            ChannelChatReport.objects.filter(channel_id=channel_id, status=ChannelChatReport.Status.OPEN)
            .select_related("message", "message__user", "reporter")
            .order_by("-created_at")[:50]
        )
        results = []
        for r in rows:
            m = r.message
            results.append(
                {
                    "id": r.id,
                    "message_id": m.id,
                    "message_body": (m.body or "")[:200] if m and not m.deleted_at else "",
                    "message_username": m.user.username if m and m.user_id else "?",
                    "reporter_username": r.reporter.username,
                    "reason": r.reason,
                    "created_at": r.created_at.isoformat(),
                }
            )
        return Response({"results": results})

    def patch(self, request, channel_id: int):
        report_id = request.data.get("report_id")
        try:
            report_id = int(report_id)
        except (TypeError, ValueError):
            return Response({"detail": "invalid_report"}, status=status.HTTP_400_BAD_REQUEST)
        if not is_channel_staff(channel_id, request.user.id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        report = get_object_or_404(ChannelChatReport, id=report_id, channel_id=channel_id)
        new_status = str(request.data.get("status") or "").strip().lower()
        if new_status not in (ChannelChatReport.Status.DISMISSED, ChannelChatReport.Status.OPEN):
            return Response({"detail": "invalid_status"}, status=status.HTTP_400_BAD_REQUEST)
        report.status = new_status
        report.save(update_fields=["status"])
        return Response({"id": report.id, "status": report.status})


class ChannelChatBanView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, user_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        target = User.objects.filter(id=user_id).first()
        if target is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            hours = int(request.data.get("hours") or 24)
        except (TypeError, ValueError):
            hours = 24
        reason = str(request.data.get("reason") or "")[:280]
        row = ban_user(channel_id, user_id, banned_by_id=request.user.id, hours=hours, reason=reason)
        return Response(
            {
                "user_id": user_id,
                "banned_until": row.banned_until.isoformat(),
                "reason": row.reason,
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, channel_id: int, user_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        unban_user(channel_id, user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelChatBanStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_channel_staff(channel_id, request.user.id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        now = timezone.now()
        from apps.channels.models import ChannelChatBan

        rows = ChannelChatBan.objects.filter(channel_id=channel_id, banned_until__gt=now).select_related("user")
        return Response(
            {
                "results": [
                    {
                        "user_id": r.user_id,
                        "username": r.user.username,
                        "banned_until": r.banned_until.isoformat(),
                        "reason": r.reason,
                    }
                    for r in rows
                ]
            }
        )
