from django.urls import path

from apps.discovery.api.views import ExploreFeedView, GlobalSearchView, TrackFacetsView

urlpatterns = [
    path("explore", ExploreFeedView.as_view()),
    path("search/global", GlobalSearchView.as_view()),
    path("tracks/facets", TrackFacetsView.as_view()),
]
