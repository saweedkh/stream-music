from django.urls import path

from apps.admin_panel.admin.admin_api import (
    AdminBadgeDetailView,
    AdminBadgesView,
    AdminChannelDetailView,
    AdminChannelsView,
    AdminHealthView,
    AdminOverviewView,
    AdminTrackImportsView,
    AdminUserDetailView,
    AdminUsersView,
)
from apps.admin_panel.admin.admin_content_api import (
    AdminPlaylistDetailView,
    AdminPlaylistsView,
    AdminTrackDetailView,
    AdminTracksView,
)
from apps.admin_panel.admin.premium_codes_api import AdminPremiumCodeDetailView, AdminPremiumCodesView

urlpatterns = [
    path("admin/overview", AdminOverviewView.as_view()),
    path("admin/users", AdminUsersView.as_view()),
    path("admin/users/<int:user_id>", AdminUserDetailView.as_view()),
    path("admin/badges", AdminBadgesView.as_view()),
    path("admin/badges/<int:badge_id>", AdminBadgeDetailView.as_view()),
    path("admin/channels", AdminChannelsView.as_view()),
    path("admin/channels/<int:channel_id>", AdminChannelDetailView.as_view()),
    path("admin/tracks", AdminTracksView.as_view()),
    path("admin/tracks/<int:track_id>", AdminTrackDetailView.as_view()),
    path("admin/playlists", AdminPlaylistsView.as_view()),
    path("admin/playlists/<int:playlist_id>", AdminPlaylistDetailView.as_view()),
    path("admin/health", AdminHealthView.as_view()),
    path("admin/track-imports", AdminTrackImportsView.as_view()),
    path("admin/premium-codes", AdminPremiumCodesView.as_view()),
    path("admin/premium-codes/<int:code_id>", AdminPremiumCodeDetailView.as_view()),
]
