"""Playlist CRUD, favorite, and add-tracks API tests."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserPlaylistFavorite
from apps.playlists.models import Playlist, PlaylistItem
from apps.tracks.models import Track


def _audio(name: str = "p.mp3") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, b"fake", content_type="audio/mpeg")


class PlaylistCRUDTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="plistuser", password="pw123456")

    def test_create_list_playlist(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post("/api/playlists/", {"name": "My Mix"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        res_list = self.client.get("/api/playlists/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        names = [p["name"] for p in res_list.data]
        self.assertIn("My Mix", names)

    def test_playlist_detail_update_delete(self):
        pl = Playlist.objects.create(name="Old", owner=self.user)
        self.client.force_authenticate(user=self.user)
        res = self.client.get(f"/api/playlists/{pl.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res_patch = self.client.patch(f"/api/playlists/{pl.id}/", {"name": "New"}, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        pl.refresh_from_db()
        self.assertEqual(pl.name, "New")
        res_del = self.client.delete(f"/api/playlists/{pl.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Playlist.objects.filter(id=pl.id).exists())

    def test_playlist_favorite_toggle(self):
        pl = Playlist.objects.create(name="Fav PL", owner=self.user)
        self.client.force_authenticate(user=self.user)
        res_add = self.client.post(f"/api/playlists/{pl.id}/favorite/")
        self.assertEqual(res_add.status_code, status.HTTP_200_OK)
        self.assertTrue(UserPlaylistFavorite.objects.filter(user=self.user, playlist=pl).exists())
        res_del = self.client.delete(f"/api/playlists/{pl.id}/favorite/")
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(UserPlaylistFavorite.objects.filter(user=self.user, playlist=pl).exists())

    def test_add_tracks_to_playlist(self):
        track = Track.objects.create(
            owner=self.user,
            title="Add Me",
            artist="",
            album="",
            file=_audio(),
            visibility=Track.Visibility.PUBLIC_LAN,
        )
        pl = Playlist.objects.create(name="Builder", owner=self.user)
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            f"/api/playlists/{pl.id}/add-tracks/",
            {"track_ids": [track.id]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["added"], 1)
        self.assertTrue(PlaylistItem.objects.filter(playlist=pl, track=track).exists())
