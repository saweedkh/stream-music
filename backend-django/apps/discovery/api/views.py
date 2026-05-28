from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.discovery.services.explore_feed import build_explore_feed
from apps.discovery.services.global_search import build_global_search, build_track_facets


class GlobalSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        return Response(build_global_search(request, q))


class TrackFacetsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_track_facets(request.user))


class ExploreFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = str(request.query_params.get("q") or "").strip().lower()
        lang = str(request.query_params.get("lang") or "").strip()
        genre = str(request.query_params.get("genre") or "").strip()
        live_only = str(request.query_params.get("live_only") or "").lower() in {"1", "true", "yes"}
        return Response(build_explore_feed(request, q=q, lang=lang, genre=genre, live_only=live_only))
