"""External URL import security and flow tests."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from apps.tracks.services.external_audio_import import (
    ExternalImportError,
    import_track_from_url,
    validate_music_url,
)


class ExternalImportValidationTests(TestCase):
    def test_rejects_non_youtube(self):
        with self.assertRaises(ExternalImportError) as ctx:
            validate_music_url("https://open.spotify.com/track/abc")
        self.assertEqual(ctx.exception.code, "unsupported_host")

    def test_accepts_youtube_watch(self):
        url, source = validate_music_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        self.assertEqual(source, "youtube")
        self.assertIn("youtube", url)


class ExternalImportTrackTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("importer", password="pass12345")

    @override_settings(EXTERNAL_IMPORT_ENABLED=True)
    @patch("apps.tracks.services.external_audio_import._run_ytdlp")
    def test_import_creates_track(self, mock_ytdlp):
        from pathlib import Path
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(b"fake-audio-content-for-test")
            path = Path(tmp.name)
        mock_ytdlp.return_value = path
        track = import_track_from_url(self.user.id, "https://www.youtube.com/watch?v=test1234567")
        self.assertEqual(track.owner_id, self.user.id)
        self.assertEqual(track.import_source, "youtube")
        self.assertTrue(track.file.name)
