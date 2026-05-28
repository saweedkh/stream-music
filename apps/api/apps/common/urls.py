from django.urls import include, path

urlpatterns = [
    path("", include("apps.core.api.urls")),
    path("", include("apps.accounts.api.urls")),
    path("", include("apps.tracks.api.urls")),
    path("", include("apps.playlists.api.urls")),
    path("", include("apps.channels.api.urls")),
    path("", include("apps.discovery.api.urls")),
    path("", include("apps.social.api.urls")),
    path("", include("apps.dashboard.api.urls")),
    path("", include("apps.moderation.api.urls")),
    path("", include("apps.support.api.urls")),
    path("", include("apps.admin_panel.api.urls")),
]
