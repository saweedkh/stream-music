"""Track list and create."""

from __future__ import annotations

from rest_framework import generics, permissions
from rest_framework.response import Response

from apps.accounts.selectors import favorited_track_ids
from apps.tracks.selectors import tracks_list_queryset
from apps.tracks.tracks.track_serializers import TrackSerializer


class TrackListCreateView(generics.ListCreateAPIView):
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            ctx["favorited_track_ids"] = favorited_track_ids(user)
        return ctx

    def get_queryset(self):
        return tracks_list_queryset(self.request.user, self.request.query_params)

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        offset_raw = request.query_params.get("offset")
        if offset_raw is not None and offset_raw != "":
            try:
                offset = max(0, int(offset_raw))
            except (TypeError, ValueError):
                offset = 0
            raw_limit = request.query_params.get("limit", "50")
            try:
                lim = int(raw_limit)
            except (TypeError, ValueError):
                lim = 50
            lim = max(1, min(lim, 200))
            total = qs.count()
            page_qs = qs[offset : offset + lim]
            serializer = self.get_serializer(page_qs, many=True)
            return Response({"results": serializer.data, "total": total, "offset": offset, "limit": lim})

        raw_limit = request.query_params.get("limit")
        search = (request.query_params.get("search") or "").strip()
        if raw_limit not in (None, ""):
            try:
                lim = int(raw_limit)
            except (TypeError, ValueError):
                lim = None
            if lim is not None:
                lim = max(1, min(lim, 500))
                qs = qs[:lim]
        elif search:
            qs = qs[:100]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
