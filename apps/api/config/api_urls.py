"""REST API URL aggregation (all domain apps)."""

from django.urls import include, path

urlpatterns = [
    path("", include("apps.core.urls")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.tracks.urls")),
    path("", include("apps.playlists.urls")),
    path("", include("apps.channels.urls")),
    path("", include("apps.discovery.urls")),
    path("", include("apps.social.urls")),
    path("", include("apps.dashboard.urls")),
    path("", include("apps.moderation.urls")),
    path("", include("apps.support.urls")),
    path("", include("apps.admin_panel.urls")),
]
