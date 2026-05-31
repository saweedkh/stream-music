from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.playlists.models import Playlist, PlaylistItem
from apps.playlists.services.backup_export import build_playlist_backup_payload
from apps.tracks.models import Track


class PlaylistBackupImportTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="import_user", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_roundtrip_export_import(self):
        pl = Playlist.objects.create(owner=self.user, name="Source")
        from django.core.files.uploadedfile import SimpleUploadedFile

        track = Track.objects.create(
            owner=self.user,
            title="T1",
            file_hash="abc123",
            file=SimpleUploadedFile("t.wav", b"x"),
        )
        PlaylistItem.objects.create(playlist=pl, track=track, position=0)

        payload = build_playlist_backup_payload(self.user)
        res = self.client.post("/api/playlists/backup-import", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["created_playlists"], 1)
        self.assertGreaterEqual(data["created_items"], 1)
        self.assertEqual(Playlist.objects.filter(owner=self.user).count(), 2)
