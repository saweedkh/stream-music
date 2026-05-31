from django.urls import path

from apps.analytics.auth.me.gamification.gamification_api import MeGamificationView
from apps.analytics.channels.channel_id.statistics.detailed.detailed_api import (
    ChannelStatisticsDetailedView,
)
from apps.analytics.channels.channel_id.statistics.heartbeat.heartbeat_api import (
    ChannelListenHeartbeatView,
)
from apps.analytics.channels.channel_id.statistics.public.public_api import (
    ChannelStatisticsPublicView,
)

urlpatterns = [
    path("auth/me/gamification", MeGamificationView.as_view()),
    path("channels/<int:channel_id>/statistics", ChannelStatisticsPublicView.as_view()),
    path("channels/<int:channel_id>/statistics/detailed", ChannelStatisticsDetailedView.as_view()),
    path("channels/<int:channel_id>/statistics/heartbeat", ChannelListenHeartbeatView.as_view()),
]
