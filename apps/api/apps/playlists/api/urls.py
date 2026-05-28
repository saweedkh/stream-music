from django.urls import path

from apps.playlists.api.share_views import (
    PlaylistShareImportView,
    PlaylistShareLinkView,
    PlaylistSharePreviewView,
)

urlpatterns = [
    path("playlists/<int:playlist_id>/share", PlaylistShareLinkView.as_view()),
    path("playlists/share/<uuid:token>", PlaylistSharePreviewView.as_view()),
    path("channels/<int:channel_id>/playlists/import-share", PlaylistShareImportView.as_view()),
]
