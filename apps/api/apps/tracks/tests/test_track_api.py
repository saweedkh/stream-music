"""Track list/create, detail, and favorite API tests."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserTrackFavorite
from apps.tracks.models import Track


def _audio(name: str = "t.mp3") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, b"fake", content_type="audio/mpeg")


class TrackCRUDTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="trackuser", password="pw123456")
        self.other = User.objects.create_user(username="other", password="pw123456")

    def test_create_and_list_tracks(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            "/api/tracks/",
            {"title": "Song A", "artist": "Artist", "file": _audio("a.mp3"), "visibility": "public_lan"},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["title"], "Song A")
        res_list = self.client.get("/api/tracks/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        titles = [t["title"] for t in res_list.data]
        self.assertIn("Song A", titles)

    def test_track_detail_and_update(self):
        track = Track.objects.create(
            owner=self.user,
            title="Detail",
            artist="",
            album="",
            file=_audio("d.mp3"),
            visibility=Track.Visibility.PUBLIC_LAN,
        )
        self.client.force_authenticate(user=self.user)
        res = self.client.get(f"/api/tracks/{track.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res_patch = self.client.patch(f"/api/tracks/{track.id}/", {"title": "Renamed"}, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        track.refresh_from_db()
        self.assertEqual(track.title, "Renamed")

    def test_track_favorite_toggle(self):
        track = Track.objects.create(
            owner=self.user,
            title="Fav",
            artist="",
            album="",
            file=_audio("f.mp3"),
            visibility=Track.Visibility.PUBLIC_LAN,
        )
        self.client.force_authenticate(user=self.user)
        res_add = self.client.post(f"/api/tracks/{track.id}/favorite/")
        self.assertEqual(res_add.status_code, status.HTTP_200_OK)
        self.assertTrue(res_add.data["is_favorited"])
        self.assertTrue(UserTrackFavorite.objects.filter(user=self.user, track=track).exists())
        res_del = self.client.delete(f"/api/tracks/{track.id}/favorite/")
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(res_del.data["is_favorited"])
        self.assertFalse(UserTrackFavorite.objects.filter(user=self.user, track=track).exists())

    def test_tracks_require_auth(self):
        res = self.client.get("/api/tracks/")
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
