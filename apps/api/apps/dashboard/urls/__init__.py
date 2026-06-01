from django.urls import path

from apps.dashboard.me.channels_online.channels_online_api import MeChannelsOnlineView
from apps.dashboard.me.channels_pending_suggestions.channels_pending_suggestions_api import (
    MeChannelsPendingSuggestionsView,
)

urlpatterns = [
    path("me/channels-online", MeChannelsOnlineView.as_view()),
    path("me/channels-pending-suggestions", MeChannelsPendingSuggestionsView.as_view()),
]
