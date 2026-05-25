from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from apps.tracks.models import Track


class TrackModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="pw")

    def test_create_track_defaults(self):
        audio = SimpleUploadedFile("song.mp3", b"fake-audio", content_type="audio/mpeg")
        track = Track.objects.create(
            owner=self.user,
            title="Sunset Drive",
            file=audio,
        )
        self.assertEqual(track.title, "Sunset Drive")
        self.assertEqual(track.artist, "")
        self.assertEqual(track.album, "")
        self.assertEqual(track.visibility, Track.Visibility.PRIVATE)
        self.assertEqual(track.duration_seconds, 0)

    def test_create_track_with_metadata(self):
        audio = SimpleUploadedFile("track.mp3", b"data", content_type="audio/mpeg")
        track = Track.objects.create(
            owner=self.user,
            title="Dawn",
            artist="The Band",
            album="First Light",
            genre="Electronic",
            visibility=Track.Visibility.PUBLIC_LAN,
            duration_seconds=245.5,
            file=audio,
        )
        self.assertEqual(track.artist, "The Band")
        self.assertEqual(track.genre, "Electronic")
        self.assertEqual(track.visibility, "public_lan")
        self.assertAlmostEqual(track.duration_seconds, 245.5)

    def test_visibility_choices(self):
        expected = {"private", "shared_with_users", "shared_with_channels", "public_lan"}
        actual = {c[0] for c in Track.Visibility.choices}
        self.assertEqual(expected, actual)
