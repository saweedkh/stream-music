"""Chunked track upload init, finalize, and status API tests."""

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tracks.models import Track

# Minimal bytes stored as .mp3 during chunked finalize tests.
_FAKE_MP3 = b"ID3" + b"\x00" * 128


class TrackUploadApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="uploader", password="pw123456")
        self.client.force_authenticate(user=self.user)

    def _init_upload(self, *, size: int | None = None, title: str = "Upload Test") -> str:
        body = _FAKE_MP3 if size is None else _FAKE_MP3[:size]
        size = len(body)
        init = self.client.post(
            "/api/tracks/upload/init",
            {
                "filename": "song.mp3",
                "size": size,
                "title": title,
                "visibility": "private",
            },
            format="json",
        )
        self.assertEqual(init.status_code, status.HTTP_200_OK)
        upload_id = init.data["upload_id"]
        chunk = self.client.put(
            f"/api/tracks/upload/{upload_id}/chunk",
            data=body,
            content_type="application/octet-stream",
        )
        self.assertEqual(chunk.status_code, status.HTTP_200_OK)
        return upload_id

    def test_upload_init_and_status(self):
        init = self.client.post(
            "/api/tracks/upload/init",
            {
                "filename": "song.mp3",
                "size": len(_FAKE_MP3),
                "title": "Upload Test",
                "visibility": "private",
            },
            format="json",
        )
        self.assertEqual(init.status_code, status.HTTP_200_OK)
        upload_id = init.data["upload_id"]
        self.assertEqual(init.data["written"], 0)

        status_res = self.client.get(f"/api/tracks/upload/{upload_id}/status")
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertEqual(status_res.data["upload_id"], upload_id)
        self.assertEqual(status_res.data["title"], "Upload Test")

    def test_upload_init_requires_title(self):
        res = self.client.post(
            "/api/tracks/upload/init",
            {"filename": "song.mp3", "size": 100},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_status_other_user_forbidden(self):
        init = self.client.post(
            "/api/tracks/upload/init",
            {"filename": "a.mp3", "size": 100, "title": "Mine", "visibility": "private"},
            format="json",
        )
        upload_id = init.data["upload_id"]
        other = User.objects.create_user(username="otherup", password="pw123456")
        self.client.force_authenticate(user=other)
        res = self.client.get(f"/api/tracks/upload/{upload_id}/status")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_upload_finalize_creates_track(self):
        upload_id = self._init_upload(title="Finalize Me")
        with self.settings(TRANSCODE_LOW_ENABLED=False):
            res = self.client.post(f"/api/tracks/upload/{upload_id}/finalize")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["title"], "Finalize Me")
        self.assertTrue(Track.objects.filter(owner=self.user, title="Finalize Me").exists())

    def test_upload_finalize_duplicate_returns_existing(self):
        upload_id = self._init_upload(title="Dup Song")
        with self.settings(TRANSCODE_LOW_ENABLED=False):
            first = self.client.post(f"/api/tracks/upload/{upload_id}/finalize")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        upload_id_2 = self._init_upload(title="Dup Song Again")
        with self.settings(TRANSCODE_LOW_ENABLED=False):
            second = self.client.post(f"/api/tracks/upload/{upload_id_2}/finalize")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data.get("duplicate"))
        self.assertEqual(second.data["id"], first.data["id"])
