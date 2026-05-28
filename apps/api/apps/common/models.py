"""Register all ORM models for the common app."""

from apps.common.account_badges import UserBadgeAssignment, UserBadgeDefinition
from apps.common.favorites import UserPlaylistFavorite, UserTrackFavorite
from apps.common.social_models import ChannelFollow, PlaylistShareLink, UserFollow, UserPublicProfile
from apps.common.support_models import SupportMessage, SupportTicket, SupportTicketRead

__all__ = [
    "UserTrackFavorite",
    "UserPlaylistFavorite",
    "UserBadgeDefinition",
    "UserBadgeAssignment",
    "SupportTicket",
    "SupportMessage",
    "SupportTicketRead",
    "UserPublicProfile",
    "PlaylistShareLink",
    "ChannelFollow",
    "UserFollow",
]
