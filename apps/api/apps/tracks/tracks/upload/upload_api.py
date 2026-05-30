import hashlib
import os

from django.core.files import File
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tracks.chunk_upload import append_chunk, cleanup_files, finalize_path, get_session, init_session
from apps.tracks.models import Track
from apps.tracks.tracks.track_serializers import TrackSerializer


class TrackUploadInitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        filename = (request.data.get("filename") or "").strip() or "audio.mp3"
        try:
            size = int(request.data.get("size") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "invalid_size"}, status=status.HTTP_400_BAD_REQUEST)
        title = (request.data.get("title") or "").strip()
        if not title:
            return Response({"detail": "title_required"}, status=status.HTTP_400_BAD_REQUEST)
        visibility = request.data.get("visibility") or Track.Visibility.PRIVATE
        if visibility not in {v for v, _ in Track.Visibility.choices}:
            return Response({"detail": "invalid_visibility"}, status=status.HTTP_400_BAD_REQUEST)
        artist = (request.data.get("artist") or "").strip()
        album = (request.data.get("album") or "").strip()
        genre = (request.data.get("genre") or "").strip()[:120]
        raw_tags = request.data.get("tags")
        tags: list[str] = []
        if isinstance(raw_tags, list):
            tags = [str(t).strip() for t in raw_tags if str(t).strip()][:20]
        try:
            upload_id = init_session(
                user_id=request.user.id,
                filename=filename,
                size=size,
                meta={
                    "title": title,
                    "visibility": visibility,
                    "artist": artist,
                    "album": album,
                    "genre": genre,
                    "tags": tags,
                },
            )
        except ValueError as e:
            if str(e) == "invalid_size":
                return Response({"detail": "invalid_size"}, status=status.HTTP_400_BAD_REQUEST)
            raise
        return Response({"upload_id": upload_id, "written": 0, "size": size})


class TrackUploadStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, upload_id: str):
        meta = get_session(upload_id)
        if not meta or meta.get("user_id") != request.user.id:
            return Response({"detail": "invalid_session"}, status=status.HTTP_404_NOT_FOUND)
        written = int(meta.get("written") or 0)
        return Response(
            {
                "upload_id": str(upload_id),
                "written": written,
                "size": int(meta.get("size") or 0),
                "filename": meta.get("filename"),
                "title": meta.get("title"),
                "visibility": meta.get("visibility"),
            }
        )


class TrackUploadChunkView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes: list = []

    def put(self, request, upload_id: str):
        try:
            meta = append_chunk(upload_id=upload_id, user_id=request.user.id, data=request.body or b"")
        except PermissionError:
            return Response({"detail": "invalid_session"}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            if str(e) == "chunk_too_large":
                return Response({"detail": "chunk_too_large"}, status=status.HTTP_400_BAD_REQUEST)
            if str(e) == "size_exceeded":
                return Response({"detail": "size_exceeded"}, status=status.HTTP_400_BAD_REQUEST)
            raise
        return Response(
            {"written": meta.get("written", 0), "expected": meta.get("size", 0)},
            status=status.HTTP_200_OK,
        )


class TrackUploadFinalizeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, upload_id: str):
        try:
            meta = finalize_path(upload_id, user_id=request.user.id)
        except PermissionError:
            return Response({"detail": "invalid_session"}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            if str(e) == "incomplete_upload":
                return Response({"detail": "incomplete_upload"}, status=status.HTTP_400_BAD_REQUEST)
            raise

        path = meta["path"]
        django_name = meta["filename"]
        digest = hashlib.sha256()
        try:
            with open(path, "rb") as fh:
                while True:
                    chunk = fh.read(1024 * 1024)
                    if not chunk:
                        break
                    digest.update(chunk)
            file_hash = digest.hexdigest()
            existing = Track.objects.filter(owner=request.user, file_hash=file_hash).first()
            if existing:
                cleanup_files(upload_id)
                return Response(
                    {**TrackSerializer(existing).data, "duplicate": True},
                    status=status.HTTP_200_OK,
                )
            with open(path, "rb") as fh:
                django_file = File(fh, name=os.path.basename(django_name))
                track = Track.objects.create(
                    owner=request.user,
                    title=meta["title"],
                    artist=meta.get("artist") or "",
                    album=meta.get("album") or "",
                    genre=meta.get("genre") or "",
                    tags=meta.get("tags") if isinstance(meta.get("tags"), list) else [],
                    visibility=meta["visibility"],
                    file_hash=file_hash,
                    file=django_file,
                )
        finally:
            cleanup_files(upload_id)

        return Response(TrackSerializer(track).data, status=status.HTTP_201_CREATED)
