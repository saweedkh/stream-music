from django.urls import path

from apps.dashboard.api.views import MeChannelsOnlineView, MeChannelsPendingSuggestionsView

urlpatterns = [
    path("me/channels-online", MeChannelsOnlineView.as_view()),
    path("me/channels-pending-suggestions", MeChannelsPendingSuggestionsView.as_view()),
]
