from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.tracks.upload_views import TrackUploadChunkView, TrackUploadFinalizeView, TrackUploadInitView

from apps.common.views import (
    LoginView,
    LogoutView,
    MeView,
    UsersListView,
    RegisterView,
    ChannelControlView,
    ChannelInviteView,
    ChannelInviteRotateView,
    ChannelJoinFromLinkView,
    ChannelJoinRequestApproveView,
    ChannelJoinRequestListView,
    ChannelJoinRequestRejectView,
    ChannelJoinView,
    ChannelLeaveView,
    ChannelMemberManageView,
    ChannelMembersView,
    ChannelPlayPlaylistView,
    ChannelShufflePlayView,
    ChannelQueueItemManageView,
    ChannelQueueJumpView,
    ChannelQueueView,
    ChannelPublicLinkRotateView,
    ChannelSettingsView,
    ChannelStateView,
    ChannelViewSet,
    PlaylistItemViewSet,
    PlaylistViewSet,
    TrackViewSet,
    TrackSharePermissionsView,
    api_time,
    auth_csrf,
)

router = DefaultRouter()
router.register("channels", ChannelViewSet, basename="channel")
router.register("tracks", TrackViewSet, basename="track")
router.register("playlists", PlaylistViewSet, basename="playlist")
router.register("playlist-items", PlaylistItemViewSet, basename="playlist-item")

urlpatterns = [
    path("time", api_time),
    path("auth/csrf", auth_csrf),
    path("auth/register", RegisterView.as_view()),
    path("auth/login", LoginView.as_view()),
    path("auth/logout", LogoutView.as_view()),
    path("auth/me", MeView.as_view()),
    path("auth/users", UsersListView.as_view()),
    path("channels/<int:channel_id>/state", ChannelStateView.as_view()),
    path("channels/<int:channel_id>/control", ChannelControlView.as_view()),
    path("channels/join-from-link", ChannelJoinFromLinkView.as_view()),
    path("channels/<int:channel_id>/join-requests", ChannelJoinRequestListView.as_view()),
    path("channels/<int:channel_id>/join-requests/<int:request_id>/approve", ChannelJoinRequestApproveView.as_view()),
    path("channels/<int:channel_id>/join-requests/<int:request_id>/reject", ChannelJoinRequestRejectView.as_view()),
    path("channels/<int:channel_id>/join", ChannelJoinView.as_view()),
    path("channels/<int:channel_id>/leave", ChannelLeaveView.as_view()),
    path("channels/<int:channel_id>/invite", ChannelInviteView.as_view()),
    path("channels/<int:channel_id>/invite/rotate", ChannelInviteRotateView.as_view()),
    path("channels/<int:channel_id>/public-link/rotate", ChannelPublicLinkRotateView.as_view()),
    path("channels/<int:channel_id>/settings", ChannelSettingsView.as_view()),
    path("channels/<int:channel_id>/members", ChannelMembersView.as_view()),
    path("channels/<int:channel_id>/members/<int:member_id>", ChannelMemberManageView.as_view()),
    path("channels/<int:channel_id>/playlists/shuffle", ChannelShufflePlayView.as_view()),
    path("channels/<int:channel_id>/playlists/<int:playlist_id>/play", ChannelPlayPlaylistView.as_view()),
    path("channels/<int:channel_id>/queue", ChannelQueueView.as_view()),
    path("channels/<int:channel_id>/queue/<int:item_id>", ChannelQueueItemManageView.as_view()),
    path("channels/<int:channel_id>/queue/<int:item_id>/jump", ChannelQueueJumpView.as_view()),
    path("tracks/upload/init", TrackUploadInitView.as_view()),
    path("tracks/upload/<uuid:upload_id>/chunk", TrackUploadChunkView.as_view()),
    path("tracks/upload/<uuid:upload_id>/finalize", TrackUploadFinalizeView.as_view()),
    path("tracks/<int:track_id>/share-permissions", TrackSharePermissionsView.as_view()),
    path("", include(router.urls)),
]
