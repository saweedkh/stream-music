"""Import task status polling API tests."""

from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tracks.models import Track


class TrackImportStatusApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="importstatus", password="pw123456")
        self.other = User.objects.create_user(username="otherimp", password="pw123456")
        self.track = Track.objects.create(
            owner=self.user,
            title="Imported",
            file=SimpleUploadedFile("imp.mp3", b"fake", content_type="audio/mpeg"),
            visibility=Track.Visibility.PRIVATE,
        )
        self.client.force_authenticate(user=self.user)

    @patch("apps.tracks.tracks.import_status.import_status_api.AsyncResult")
    def test_pending_task(self, mock_async):
        mock_async.return_value = MagicMock(state="PENDING", result=None)
        res = self.client.get("/api/tracks/import/task-abc/status")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "pending")

    @patch("apps.tracks.tracks.import_status.import_status_api.AsyncResult")
    def test_success_returns_track(self, mock_async):
        mock_async.return_value = MagicMock(
            state="SUCCESS",
            result={"ok": True, "track_id": self.track.id, "duplicate": False},
        )
        res = self.client.get("/api/tracks/import/task-ok/status")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "success")
        self.assertEqual(res.data["track"]["id"], self.track.id)

    @patch("apps.tracks.tracks.import_status.import_status_api.AsyncResult")
    def test_failed_task(self, mock_async):
        mock_async.return_value = MagicMock(
            state="SUCCESS",
            result={"ok": False, "detail": "download_failed"},
        )
        res = self.client.get("/api/tracks/import/task-fail/status")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "failed")
        self.assertEqual(res.data["detail"], "download_failed")

    @patch("apps.tracks.tracks.import_status.import_status_api.AsyncResult")
    def test_success_track_not_owned_returns_failed(self, mock_async):
        mock_async.return_value = MagicMock(
            state="SUCCESS",
            result={"ok": True, "track_id": self.track.id, "duplicate": False},
        )
        self.client.force_authenticate(user=self.other)
        res = self.client.get("/api/tracks/import/task-other/status")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "failed")

    def test_from_url_streaming_returns_202(self):
        with patch("apps.tracks.tracks.upload.upload_api.import_streaming_track_task") as mock_task:
            mock_task.delay.return_value = MagicMock(id="celery-task-1")
            res = self.client.post(
                "/api/tracks/upload/from-url",
                {
                    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "title": "Test",
                    "visibility": "private",
                },
                format="json",
            )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(res.data["task_id"], "celery-task-1")
        self.assertEqual(res.data["status"], "pending")
