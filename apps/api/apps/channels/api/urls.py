from django.urls import path

from apps.channels.api.room_tools import ChannelQueueImportShareView, ChannelSessionExportPlaylistView

urlpatterns = [
    path("channels/<int:channel_id>/queue/import-share", ChannelQueueImportShareView.as_view()),
    path("channels/<int:channel_id>/session/export-playlist", ChannelSessionExportPlaylistView.as_view()),
]
