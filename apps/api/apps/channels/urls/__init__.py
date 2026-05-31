from django.urls import path

from apps.channels.channel.channel_id.retrieve_update_destroy_api import ChannelRetrieveUpdateDestroyView
from apps.channels.channel.list_create_api import ChannelListCreateView
from apps.channels.channel_id.blind_guess.blind_guess_api import ChannelBlindGuessView
from apps.channels.channel_id.audit_log.audit_log_api import ChannelAuditLogView
from apps.channels.channel_id.audit_log.export.export_api import ChannelAuditExportView
from apps.channels.channel_id.chat.chat_api import ChannelChatView
from apps.channels.channel_id.chat.pin.pin_api import ChannelChatPinView
from apps.channels.channel_id.close.close_api import ChannelCloseView
from apps.channels.channel_id.control.control_api import ChannelControlView
from apps.channels.channel_id.history.history_api import ChannelPlaybackHistoryView
from apps.channels.channel_id.invite.invite_api import ChannelInviteView
from apps.channels.channel_id.invite.rotate.rotate_api import ChannelInviteRotateView
from apps.channels.channel_id.join.join_api import ChannelJoinView
from apps.channels.channel_id.join_requests.join_requests_api import ChannelJoinRequestListView
from apps.channels.channel_id.join_requests.request_id.approve.approve_api import (
    ChannelJoinRequestApproveView,
)
from apps.channels.channel_id.join_requests.request_id.reject.reject_api import (
    ChannelJoinRequestRejectView,
)
from apps.channels.channel_id.leave.leave_api import ChannelLeaveView
from apps.channels.channel_id.members.member_id.member_id_api import ChannelMemberManageView
from apps.channels.channel_id.members.members_api import ChannelMembersView
from apps.channels.channel_id.notification_settings.notification_settings_api import (
    ChannelNotificationPreferenceView,
)
from apps.channels.channel_id.party_recap.party_recap_api import ChannelPartyRecapView
from apps.channels.channel_id.playlists.playlist_id.play.play_api import ChannelPlayPlaylistView
from apps.channels.channel_id.playlists.shuffle.shuffle_api import ChannelShufflePlayView
from apps.channels.channel_id.public_link.rotate.rotate_api import ChannelPublicLinkRotateView
from apps.channels.channel_id.queue.import_share.import_share_api import ChannelQueueImportShareView
from apps.channels.channel_id.queue.item_id.item_id_api import ChannelQueueItemManageView
from apps.channels.channel_id.queue.item_id.jump.jump_api import ChannelQueueJumpView
from apps.channels.channel_id.queue.item_id.upvote.upvote_api import ChannelQueueUpvoteView
from apps.channels.channel_id.queue.queue_api import ChannelQueueView
from apps.channels.channel_id.reopen.reopen_api import ChannelReopenView
from apps.channels.channel_id.session.export_playlist.export_playlist_api import (
    ChannelSessionExportPlaylistView,
)
from apps.channels.channel_id.settings.settings_api import ChannelSettingsView
from apps.channels.channel_id.state.state_api import ChannelStateView
from apps.channels.channel_id.suggestions.suggestions_api import ChannelPlaylistSuggestionView
from apps.channels.channel_id.track_reactions.track_reactions_api import ChannelTrackReactionView
from apps.channels.channel_id.tracks.similar.similar_api import ChannelSimilarTracksView
from apps.channels.channel_id.tracks.track_id.play.play_api import ChannelPlayTrackView
from apps.channels.join_from_link.join_from_link_api import ChannelJoinFromLinkView

urlpatterns = [
    path("channels/", ChannelListCreateView.as_view()),
    path("channels/<int:channel_id>/", ChannelRetrieveUpdateDestroyView.as_view()),
    path("channels/<int:channel_id>/state", ChannelStateView.as_view()),
    path("channels/<int:channel_id>/control", ChannelControlView.as_view()),
    path("channels/join-from-link", ChannelJoinFromLinkView.as_view()),
    path("channels/<int:channel_id>/join-requests", ChannelJoinRequestListView.as_view()),
    path(
        "channels/<int:channel_id>/join-requests/<int:request_id>/approve",
        ChannelJoinRequestApproveView.as_view(),
    ),
    path(
        "channels/<int:channel_id>/join-requests/<int:request_id>/reject",
        ChannelJoinRequestRejectView.as_view(),
    ),
    path("channels/<int:channel_id>/join", ChannelJoinView.as_view()),
    path("channels/<int:channel_id>/leave", ChannelLeaveView.as_view()),
    path("channels/<int:channel_id>/close", ChannelCloseView.as_view()),
    path("channels/<int:channel_id>/reopen", ChannelReopenView.as_view()),
    path("channels/<int:channel_id>/invite", ChannelInviteView.as_view()),
    path("channels/<int:channel_id>/invite/rotate", ChannelInviteRotateView.as_view()),
    path("channels/<int:channel_id>/public-link/rotate", ChannelPublicLinkRotateView.as_view()),
    path("channels/<int:channel_id>/tracks/similar", ChannelSimilarTracksView.as_view()),
    path("channels/<int:channel_id>/chat", ChannelChatView.as_view()),
    path("channels/<int:channel_id>/chat/pin", ChannelChatPinView.as_view()),
    path("channels/<int:channel_id>/track-reactions", ChannelTrackReactionView.as_view()),
    path("channels/<int:channel_id>/party-recap", ChannelPartyRecapView.as_view()),
    path("channels/<int:channel_id>/blind-guess", ChannelBlindGuessView.as_view()),
    path("channels/<int:channel_id>/history", ChannelPlaybackHistoryView.as_view()),
    path("channels/<int:channel_id>/audit-log", ChannelAuditLogView.as_view()),
    path("channels/<int:channel_id>/audit-log/export", ChannelAuditExportView.as_view()),
    path("channels/<int:channel_id>/suggestions", ChannelPlaylistSuggestionView.as_view()),
    path("channels/<int:channel_id>/notification-settings", ChannelNotificationPreferenceView.as_view()),
    path("channels/<int:channel_id>/settings", ChannelSettingsView.as_view()),
    path("channels/<int:channel_id>/members", ChannelMembersView.as_view()),
    path("channels/<int:channel_id>/members/<int:member_id>", ChannelMemberManageView.as_view()),
    path("channels/<int:channel_id>/playlists/shuffle", ChannelShufflePlayView.as_view()),
    path("channels/<int:channel_id>/playlists/<int:playlist_id>/play", ChannelPlayPlaylistView.as_view()),
    path("channels/<int:channel_id>/tracks/<int:track_id>/play", ChannelPlayTrackView.as_view()),
    path("channels/<int:channel_id>/queue", ChannelQueueView.as_view()),
    path("channels/<int:channel_id>/queue/<int:item_id>", ChannelQueueItemManageView.as_view()),
    path("channels/<int:channel_id>/queue/<int:item_id>/jump", ChannelQueueJumpView.as_view()),
    path("channels/<int:channel_id>/queue/<int:item_id>/upvote", ChannelQueueUpvoteView.as_view()),
    path("channels/<int:channel_id>/queue/import-share", ChannelQueueImportShareView.as_view()),
    path("channels/<int:channel_id>/session/export-playlist", ChannelSessionExportPlaylistView.as_view()),
]
