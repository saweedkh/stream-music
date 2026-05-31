from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.tracks.api.viewsets import TrackSharePermissionsView, TrackViewSet
from apps.tracks.upload_views import (
    TrackUploadChunkView,
    TrackUploadFinalizeView,
    TrackUploadFromUrlView,
    TrackUploadInitView,
    TrackUploadStatusView,
)

router = DefaultRouter()
router.register("tracks", TrackViewSet, basename="track")

urlpatterns = [
    path("tracks/upload/init", TrackUploadInitView.as_view()),
    path("tracks/upload/from-url", TrackUploadFromUrlView.as_view()),
    path("tracks/upload/<uuid:upload_id>/status", TrackUploadStatusView.as_view()),
    path("tracks/upload/<uuid:upload_id>/chunk", TrackUploadChunkView.as_view()),
    path("tracks/upload/<uuid:upload_id>/finalize", TrackUploadFinalizeView.as_view()),
    path("tracks/<int:track_id>/share-permissions", TrackSharePermissionsView.as_view()),
    *router.urls,
]
