from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.discovery.services.explore_feed import build_explore_feed


class ExploreFeedView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = str(request.query_params.get("q") or "").strip().lower()
        lang = str(request.query_params.get("lang") or "").strip()
        genre = str(request.query_params.get("genre") or "").strip()
        live_only = str(request.query_params.get("live_only") or "").lower() in {"1", "true", "yes"}
        return Response(build_explore_feed(request, q=q, lang=lang, genre=genre, live_only=live_only))
