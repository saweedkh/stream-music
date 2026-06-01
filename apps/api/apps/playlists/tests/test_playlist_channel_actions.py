"""Tests for playlist copy-to-channel and assign-to-channel with track access rules."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserPlaylistFavorite
from apps.channels.models import Channel, ChannelMembership
from apps.playlists.models import Playlist, PlaylistItem
from apps.playlists.selectors import playlist_inaccessible_track_ids
from apps.tracks.models import Track


def _audio_file(name: str = "test.mp3") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, b"fake-audio", content_type="audio/mpeg")


def _track(owner: User, *, title: str, visibility: str) -> Track:
    return Track.objects.create(
        owner=owner,
        title=title,
        artist="",
        album="",
        file=_audio_file(f"{title}.mp3"),
        visibility=visibility,
    )


def _channel(owner: User, name: str = "Test Room") -> Channel:
    ch = Channel.objects.create(name=name, owner=owner, privacy=Channel.Privacy.PUBLIC)
    ChannelMembership.objects.create(
        channel=ch,
        user=owner,
        role=ChannelMembership.Role.OWNER,
        is_active=True,
    )
    return ch


def _playlist(owner: User, name: str = "Mix", *, channel=None) -> Playlist:
    return Playlist.objects.create(name=name, owner=owner, channel=channel)


class PlaylistInaccessibleTracksTests(TestCase):
    def test_inaccessible_track_ids_for_viewer(self):
        alice = User.objects.create_user(username="alice2", password="pw123456")
        bob = User.objects.create_user(username="bob2", password="pw123456")
        public = _track(alice, title="Pub", visibility=Track.Visibility.PUBLIC_LAN)
        private = _track(bob, title="Priv", visibility=Track.Visibility.PRIVATE)
        pl = _playlist(alice, "Check")
        PlaylistItem.objects.create(playlist=pl, track=public, position=0)
        PlaylistItem.objects.create(playlist=pl, track=private, position=1)

        blocked = playlist_inaccessible_track_ids(alice, pl)
        self.assertEqual(blocked, [private.id])


class PlaylistChannelActionsTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.alice = User.objects.create_user(username="alice", password="pw123456")
        self.bob = User.objects.create_user(username="bob", password="pw123456")
        self.channel = _channel(self.alice)
        self.alice_public = _track(self.alice, title="Alice Public", visibility=Track.Visibility.PUBLIC_LAN)
        self.bob_private = _track(self.bob, title="Bob Private", visibility=Track.Visibility.PRIVATE)

    def _csrf(self):
        self.client.get("/api/auth/csrf")
        return self.client.cookies["csrftoken"].value

    def _login(self, user: User):
        csrf = self._csrf()
        self.client.post(
            "/api/auth/login",
            {"username": user.username, "password": "pw123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

    def _post_action(self, playlist_id: int, action: str, payload: dict):
        csrf = self._csrf()
        return self.client.post(
            f"/api/playlists/{playlist_id}/{action}/",
            payload,
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

    def test_copy_to_channel_skips_inaccessible_tracks(self):
        pl = _playlist(self.alice, "Shared mix")
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)
        PlaylistItem.objects.create(playlist=pl, track=self.bob_private, position=1)

        self._login(self.alice)
        res = self._post_action(pl.id, "copy-to-channel", {"channel_id": self.channel.id})
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertEqual(body["added"], 1)
        self.assertEqual(body["skipped_inaccessible"], 1)
        dest = Playlist.objects.get(id=body["playlist"]["id"])
        self.assertEqual(dest.channel_id, self.channel.id)
        self.assertEqual(dest.owner_id, self.alice.id)
        dest_track_ids = list(dest.items.order_by("position").values_list("track_id", flat=True))
        self.assertEqual(dest_track_ids, [self.alice_public.id])

    def test_copy_to_channel_all_accessible(self):
        pl = _playlist(self.alice, "Clean mix")
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)

        self._login(self.alice)
        res = self._post_action(pl.id, "copy-to-channel", {"channel_id": self.channel.id})
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertEqual(body["added"], 1)
        self.assertEqual(body["skipped_inaccessible"], 0)

    def test_assign_to_channel_rejects_inaccessible_tracks(self):
        pl = _playlist(self.alice, "Blocked link")
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)
        PlaylistItem.objects.create(playlist=pl, track=self.bob_private, position=1)

        self._login(self.alice)
        res = self._post_action(pl.id, "assign-to-channel", {"channel_id": self.channel.id})
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertEqual(body["detail"], "playlist_has_inaccessible_tracks")
        self.assertEqual(body["inaccessible_count"], 1)
        pl.refresh_from_db()
        self.assertIsNone(pl.channel_id)

    def test_assign_to_channel_success(self):
        pl = _playlist(self.alice, "Link me")
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)

        self._login(self.alice)
        res = self._post_action(pl.id, "assign-to-channel", {"channel_id": self.channel.id})
        self.assertEqual(res.status_code, 200)
        pl.refresh_from_db()
        self.assertEqual(pl.channel_id, self.channel.id)
        self.assertEqual(res.json()["channel"], self.channel.id)

    def test_assign_to_channel_owner_only(self):
        pl = _playlist(self.alice, "Alice only")
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)
        UserPlaylistFavorite.objects.create(user=self.bob, playlist=pl)
        bob_channel = _channel(self.bob, "Bob Room")

        self._login(self.bob)
        res = self._post_action(pl.id, "assign-to-channel", {"channel_id": bob_channel.id})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["detail"], "playlist_assign_owner_only")

    def test_assign_to_channel_already_linked(self):
        pl = _playlist(self.alice, "On channel", channel=self.channel)
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)

        self._login(self.alice)
        res = self._post_action(pl.id, "assign-to-channel", {"channel_id": self.channel.id})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["detail"], "playlist_already_on_channel")

    def test_copy_favorited_playlist_from_other_user(self):
        pl = _playlist(self.bob, "Bob mix")
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)

        bob_channel = _channel(self.bob, "Bob Room")
        UserPlaylistFavorite.objects.create(user=self.alice, playlist=pl)

        self._login(self.alice)
        res = self._post_action(pl.id, "copy-to-channel", {"channel_id": bob_channel.id})
        self.assertEqual(res.status_code, 403)

        ChannelMembership.objects.create(
            channel=bob_channel,
            user=self.alice,
            role=ChannelMembership.Role.MODERATOR,
            is_active=True,
        )
        res = self._post_action(pl.id, "copy-to-channel", {"channel_id": bob_channel.id})
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertEqual(body["added"], 1)
        self.assertEqual(body["skipped_inaccessible"], 0)
        self.assertEqual(body["playlist"]["channel"], bob_channel.id)

    def test_assign_requires_channel_manage_permission(self):
        pl = _playlist(self.alice, "No mod")
        PlaylistItem.objects.create(playlist=pl, track=self.alice_public, position=0)

        other_channel = _channel(self.bob, "Bob Room")
        self._login(self.alice)
        res = self._post_action(pl.id, "assign-to-channel", {"channel_id": other_channel.id})
        self.assertEqual(res.status_code, 403)
