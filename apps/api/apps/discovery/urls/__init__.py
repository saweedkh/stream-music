from django.urls import path

from apps.discovery.explore.explore_api import ExploreFeedView
from apps.discovery.me.live_feed.live_feed_api import MeLiveFeedView
from apps.discovery.search.global_search.global_api import GlobalSearchView
from apps.discovery.tracks.facets.facets_api import TrackFacetsView

urlpatterns = [
    path("explore", ExploreFeedView.as_view()),
    path("me/live-feed", MeLiveFeedView.as_view()),
    path("search/global", GlobalSearchView.as_view()),
    path("tracks/facets", TrackFacetsView.as_view()),
]
