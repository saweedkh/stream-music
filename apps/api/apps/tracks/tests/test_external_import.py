"""External URL import security and flow tests."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from apps.tracks.services.external_audio_import import (
    ExternalImportError,
    import_streaming_track,
    import_track_from_url,
    validate_music_url,
)


class ExternalImportValidationTests(TestCase):
    def test_rejects_unknown_host(self):
        with self.assertRaises(ExternalImportError) as ctx:
            validate_music_url("https://example.com/audio.mp3")
        self.assertEqual(ctx.exception.code, "unsupported_host")

    def test_accepts_youtube_watch(self):
        url, source = validate_music_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        self.assertEqual(source, "youtube")
        self.assertIn("youtube", url)

    def test_accepts_spotify_track(self):
        _url, source = validate_music_url("https://open.spotify.com/track/6rqhFgbbKwnKs9gwvtefcu")
        self.assertEqual(source, "spotify")

    def test_rejects_spotify_playlist(self):
        with self.assertRaises(ExternalImportError) as ctx:
            validate_music_url("https://open.spotify.com/playlist/37i9dQZF1DX")
        self.assertEqual(ctx.exception.code, "not_a_track_url")

    def test_accepts_soundcloud(self):
        _url, source = validate_music_url("https://soundcloud.com/artist/track-name")
        self.assertEqual(source, "soundcloud")


class ExternalImportTrackTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("importer", password="pass12345")

    @override_settings(EXTERNAL_IMPORT_ENABLED=True)
    @patch("apps.tracks.services.external_audio_import._download_for_source")
    def test_import_creates_track(self, mock_download):
        from pathlib import Path
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(b"fake-audio-content-for-test")
            path = Path(tmp.name)
        mock_download.return_value = (path, "Test Song", "Test Artist")
        track = import_track_from_url(self.user.id, "https://www.youtube.com/watch?v=test1234567")
        self.assertEqual(track.owner_id, self.user.id)
        self.assertEqual(track.import_source, "youtube")
        self.assertTrue(track.file.name)

    @override_settings(EXTERNAL_IMPORT_ENABLED=True)
    @patch("apps.tracks.services.external_audio_import._download_for_source")
    def test_streaming_import_respects_title(self, mock_download):
        from pathlib import Path
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(b"another-fake-audio")
            path = Path(tmp.name)
        mock_download.return_value = (path, "Meta title", "Meta artist")
        payload, code, dup = import_streaming_track(
            user=self.user,
            url="https://soundcloud.com/artist/song",
            title="Custom title",
            visibility="private",
        )
        self.assertFalse(dup)
        self.assertEqual(code, 201)
        self.assertEqual(payload["title"], "Custom title")
