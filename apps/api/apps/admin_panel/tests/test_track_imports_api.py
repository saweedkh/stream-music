"""Admin track import audit API tests."""

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tracks.models import Track


class AdminTrackImportsApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("adminimp", "a@e.com", "pw123456")
        self.user = User.objects.create_user("regular", password="pw123456")
        track = Track.objects.create(
            owner=self.user,
            title="Imported Song",
            import_source="youtube",
            source_url="https://youtube.com/watch?v=abc",
        )
        track.file.save("t.mp3", ContentFile(b"x"), save=True)
        self.track_id = track.id

    def test_requires_superuser(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get("/api/admin/track-imports")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_lists_imports(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/admin/track-imports")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data["total"], 1)
        ids = [row["id"] for row in res.data["results"]]
        self.assertIn(self.track_id, ids)
