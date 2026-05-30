from django.urls import path

from apps.moderation.channels.moderation.moderation_api import (
    ChannelChatBanStatusView,
    ChannelChatBanView,
    ChannelChatReportView,
    ChannelModerationReportsView,
)

urlpatterns = [
    path("channels/<int:channel_id>/chat/report", ChannelChatReportView.as_view()),
    path("channels/<int:channel_id>/moderation/reports", ChannelModerationReportsView.as_view()),
    path("channels/<int:channel_id>/moderation/bans", ChannelChatBanStatusView.as_view()),
    path("channels/<int:channel_id>/moderation/bans/<int:user_id>", ChannelChatBanView.as_view()),
]
