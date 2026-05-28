from django.urls import path

from apps.social.api.views import ChannelFollowView, FollowingChannelsFeedView, UserFollowView

urlpatterns = [
    path("me/following-channels", FollowingChannelsFeedView.as_view()),
    path("channels/<int:channel_id>/follow", ChannelFollowView.as_view()),
    path("users/<str:username>/follow", UserFollowView.as_view()),
]
