"""Chunked track upload init and status API tests."""

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase


class TrackUploadApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="uploader", password="pw123456")
        self.client.force_authenticate(user=self.user)

    def test_upload_init_and_status(self):
        init = self.client.post(
            "/api/tracks/upload/init",
            {
                "filename": "song.mp3",
                "size": 4096,
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
