from django.urls import path

from apps.tracks.tracks.import_external.import_external_api import TrackImportExternalView
from apps.tracks.tracks.list_create_api import TrackListCreateView
from apps.tracks.tracks.track_id.favorite.favorite_api import TrackFavoriteView
from apps.tracks.tracks.track_id.retrieve_update_destroy_api import TrackRetrieveUpdateDestroyView
from apps.tracks.tracks.track_id.share_permissions.share_permissions_api import TrackSharePermissionsView
from apps.tracks.tracks.upload.upload_api import (
    TrackUploadChunkView,
    TrackUploadFinalizeView,
    TrackUploadInitView,
    TrackUploadStatusView,
)

urlpatterns = [
    path("tracks/", TrackListCreateView.as_view()),
    path("tracks/import-external", TrackImportExternalView.as_view()),
    path("tracks/<int:track_id>/", TrackRetrieveUpdateDestroyView.as_view()),
    path("tracks/<int:track_id>/favorite/", TrackFavoriteView.as_view()),
    path("tracks/upload/init", TrackUploadInitView.as_view()),
    path("tracks/upload/<uuid:upload_id>/status", TrackUploadStatusView.as_view()),
    path("tracks/upload/<uuid:upload_id>/chunk", TrackUploadChunkView.as_view()),
    path("tracks/upload/<uuid:upload_id>/finalize", TrackUploadFinalizeView.as_view()),
    path("tracks/<int:track_id>/share-permissions", TrackSharePermissionsView.as_view()),
]
