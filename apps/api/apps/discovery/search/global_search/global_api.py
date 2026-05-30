from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.discovery.services.global_search import build_global_search


class GlobalSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        return Response(build_global_search(request, q))
