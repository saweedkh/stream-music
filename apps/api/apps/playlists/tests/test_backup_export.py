from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.playlists.models import Playlist, PlaylistItem
from apps.tracks.models import Track


class PlaylistBackupExportTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="backup_user", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_backup_export_lists_playlists_and_items(self):
        pl = Playlist.objects.create(owner=self.user, name="My mix")
        track = Track.objects.create(
            owner=self.user,
            title="Song A",
            artist="Artist",
            file_hash="deadbeef",
        )
        PlaylistItem.objects.create(playlist=pl, track=track, position=0)

        res = self.client.get("/api/playlists/backup-export")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["format"], "stream-music-playlist-backup")
        self.assertEqual(len(data["playlists"]), 1)
        self.assertEqual(data["playlists"][0]["name"], "My mix")
        self.assertEqual(len(data["playlists"][0]["items"]), 1)
        self.assertEqual(data["playlists"][0]["items"][0]["title"], "Song A")
