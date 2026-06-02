"""Poll Celery result for async streaming track import."""

from __future__ import annotations

from celery.result import AsyncResult
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tracks.tracks.track_serializers import TrackSerializer
from apps.tracks.models import Track


class TrackImportStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, task_id: str):
        result = AsyncResult(task_id)
        state = result.state

        if state in {"PENDING", "RECEIVED", "STARTED", "RETRY"}:
            return Response({"status": "pending", "task_id": task_id})

        if state == "FAILURE":
            detail = "import_failed"
            try:
                exc = result.result
                if isinstance(exc, Exception):
                    detail = str(exc)[:120] or detail
            except Exception:
                pass
            return Response(
                {"status": "failed", "detail": detail, "task_id": task_id},
                status=status.HTTP_200_OK,
            )

        if state == "SUCCESS":
            payload = result.result if isinstance(result.result, dict) else {}
            if not payload.get("ok"):
                return Response(
                    {
                        "status": "failed",
                        "detail": payload.get("detail") or "import_failed",
                        "task_id": task_id,
                    },
                    status=status.HTTP_200_OK,
                )
            track_id = payload.get("track_id")
            if not track_id:
                return Response(
                    {"status": "failed", "detail": "import_failed", "task_id": task_id},
                    status=status.HTTP_200_OK,
                )
            track = Track.objects.filter(pk=track_id, owner=request.user).first()
            if not track:
                return Response(
                    {"status": "failed", "detail": "import_failed", "task_id": task_id},
                    status=status.HTTP_200_OK,
                )
            data = TrackSerializer(track, context={"request": request}).data
            return Response(
                {
                    "status": "success",
                    "task_id": task_id,
                    "duplicate": bool(payload.get("duplicate")),
                    "track": data,
                },
                status=status.HTTP_200_OK,
            )

        return Response({"status": "pending", "task_id": task_id})
