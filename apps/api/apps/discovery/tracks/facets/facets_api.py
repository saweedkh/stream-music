from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.discovery.services.global_search import build_track_facets


class TrackFacetsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(build_track_facets(request.user))
