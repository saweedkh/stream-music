from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.playlists.api.share_views import (
    PlaylistShareImportView,
    PlaylistShareLinkView,
    PlaylistSharePreviewView,
)
from apps.playlists.api.viewsets import PlaylistItemViewSet, PlaylistViewSet

router = DefaultRouter()
router.register("playlists", PlaylistViewSet, basename="playlist")
router.register("playlist-items", PlaylistItemViewSet, basename="playlist-item")

urlpatterns = [
    path("playlists/<int:playlist_id>/share", PlaylistShareLinkView.as_view()),
    path("playlists/share/<uuid:token>", PlaylistSharePreviewView.as_view()),
    path("channels/<int:channel_id>/playlists/import-share", PlaylistShareImportView.as_view()),
    *router.urls,
]
