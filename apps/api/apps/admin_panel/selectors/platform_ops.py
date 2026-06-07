"""Platform operational counters for admin overview."""

from __future__ import annotations

from apps.channels.models import ChannelChatReport, ChannelJoinRequest, ChannelPlaylistSuggestion
from apps.playback.models import PlaybackSession
from apps.support.models import SupportTicket


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
