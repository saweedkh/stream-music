from django.urls import path

from apps.social.activity.feed.feed_api import ActivityFeedView
from apps.social.auth.me.referral.referral_api import MeReferralView
from apps.social.channels.follow.follow_api import ChannelFollowView
from apps.social.me.following_channels.following_channels_api import FollowingChannelsFeedView
from apps.social.users.follow.follow_api import UserFollowView

urlpatterns = [
    path("me/following-channels", FollowingChannelsFeedView.as_view()),
    path("me/activity-feed", ActivityFeedView.as_view()),
    path("me/referral", MeReferralView.as_view()),
    path("channels/<int:channel_id>/follow", ChannelFollowView.as_view()),
    path("users/<str:username>/follow", UserFollowView.as_view()),
]
