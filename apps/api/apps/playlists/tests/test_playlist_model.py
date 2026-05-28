from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from apps.channels.models import Channel
from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.models import Track


class PlaylistModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="pw")

    def test_create_playlist_defaults(self):
        pl = Playlist.objects.create(name="Chill Vibes", owner=self.user)
        self.assertEqual(pl.name, "Chill Vibes")
        self.assertIsNone(pl.channel)
        self.assertFalse(pl.is_auto_generated)

    def test_playlist_with_channel(self):
        ch = Channel.objects.create(name="Room", owner=self.user)
        pl = Playlist.objects.create(name="Room Playlist", owner=self.user, channel=ch)
        self.assertEqual(pl.channel_id, ch.id)


class PlaylistItemTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="pw")
        audio = SimpleUploadedFile("s.mp3", b"data", content_type="audio/mpeg")
        self.track1 = Track.objects.create(owner=self.user, title="Track 1", file=audio)
        audio2 = SimpleUploadedFile("s2.mp3", b"data", content_type="audio/mpeg")
        self.track2 = Track.objects.create(owner=self.user, title="Track 2", file=audio2)
        self.playlist = Playlist.objects.create(name="My List", owner=self.user)

    def test_create_playlist_item(self):
        item = PlaylistItem.objects.create(playlist=self.playlist, track=self.track1, position=0)
        self.assertEqual(item.position, 0)
        self.assertEqual(item.playlist_id, self.playlist.id)

    def test_ordering_by_position(self):
        PlaylistItem.objects.create(playlist=self.playlist, track=self.track2, position=2)
        PlaylistItem.objects.create(playlist=self.playlist, track=self.track1, position=1)
        items = list(PlaylistItem.objects.filter(playlist=self.playlist))
        self.assertEqual(items[0].track_id, self.track1.id)
        self.assertEqual(items[1].track_id, self.track2.id)


class ChannelQueueItemTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="pw")
        self.channel = Channel.objects.create(name="Room", owner=self.user)
        audio = SimpleUploadedFile("s.mp3", b"data", content_type="audio/mpeg")
        self.track = Track.objects.create(owner=self.user, title="Song", file=audio)

    def test_create_queue_item(self):
        qi = ChannelQueueItem.objects.create(
            channel=self.channel, track=self.track, position=0, added_by=self.user
        )
        self.assertEqual(qi.channel_id, self.channel.id)
        self.assertEqual(qi.added_by_id, self.user.id)

    def test_queue_item_without_added_by(self):
        qi = ChannelQueueItem.objects.create(channel=self.channel, track=self.track, position=0)
        self.assertIsNone(qi.added_by)
