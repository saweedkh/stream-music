from django.urls import path

from apps.admin_panel.api.views import (
    AdminBadgeDetailView,
    AdminBadgesView,
    AdminChannelDetailView,
    AdminChannelsView,
    AdminHealthView,
    AdminOverviewView,
    AdminUserDetailView,
    AdminUsersView,
)

urlpatterns = [
    path("admin/overview", AdminOverviewView.as_view()),
    path("admin/users", AdminUsersView.as_view()),
    path("admin/users/<int:user_id>", AdminUserDetailView.as_view()),
    path("admin/badges", AdminBadgesView.as_view()),
    path("admin/badges/<int:badge_id>", AdminBadgeDetailView.as_view()),
    path("admin/channels", AdminChannelsView.as_view()),
    path("admin/channels/<int:channel_id>", AdminChannelDetailView.as_view()),
    path("admin/health", AdminHealthView.as_view()),
]
