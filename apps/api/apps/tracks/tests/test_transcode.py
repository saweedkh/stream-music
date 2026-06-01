from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.tracks.models import Track
from apps.tracks.services.transcode import transcode_track_low


class TranscodeServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="transcode_user", password="x")

    @override_settings(TRANSCODE_LOW_ENABLED=True)
    @patch("apps.tracks.services.transcode.shutil.which", return_value=None)
    def test_skips_without_ffmpeg(self, _which):
        track = Track.objects.create(
            owner=self.user,
            title="t",
            file_hash="abc",
            file=SimpleUploadedFile("t.wav", b"RIFF"),
        )
        self.assertFalse(transcode_track_low(track.id))
