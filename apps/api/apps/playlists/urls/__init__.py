from django.urls import path

from apps.playlists.playlist_items.item_id.retrieve_update_destroy_api import (
    PlaylistItemRetrieveUpdateDestroyView,
)
from apps.playlists.playlist_items.list_create_api import PlaylistItemListCreateView
from apps.playlists.playlists.list_create_api import PlaylistListCreateView
from apps.playlists.playlists.playlist_id.add_tracks.add_tracks_api import PlaylistAddTracksView
from apps.playlists.playlists.playlist_id.assign_to_channel.assign_to_channel_api import (
    PlaylistAssignToChannelView,
)
from apps.playlists.playlists.playlist_id.copy_to_channel.copy_to_channel_api import (
    PlaylistCopyToChannelView,
)
from apps.playlists.playlists.playlist_id.favorite.favorite_api import PlaylistFavoriteView
from apps.playlists.playlists.playlist_id.retrieve_update_destroy_api import (
    PlaylistRetrieveUpdateDestroyView,
)
from apps.playlists.share.share_api import (
    PlaylistShareImportView,
    PlaylistShareLinkView,
    PlaylistSharePreviewView,
)

urlpatterns = [
    path("playlists/", PlaylistListCreateView.as_view()),
    path("playlists/<int:playlist_id>/", PlaylistRetrieveUpdateDestroyView.as_view()),
    path("playlists/<int:playlist_id>/favorite/", PlaylistFavoriteView.as_view()),
    path("playlists/<int:playlist_id>/add-tracks/", PlaylistAddTracksView.as_view()),
    path("playlists/<int:playlist_id>/copy-to-channel/", PlaylistCopyToChannelView.as_view()),
    path("playlists/<int:playlist_id>/assign-to-channel/", PlaylistAssignToChannelView.as_view()),
    path("playlist-items/", PlaylistItemListCreateView.as_view()),
    path("playlist-items/<int:item_id>/", PlaylistItemRetrieveUpdateDestroyView.as_view()),
    path("playlists/<int:playlist_id>/share", PlaylistShareLinkView.as_view()),
    path("playlists/share/<uuid:token>", PlaylistSharePreviewView.as_view()),
    path("channels/<int:channel_id>/playlists/import-share", PlaylistShareImportView.as_view()),
]
