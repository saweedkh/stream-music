"""Seed demo user, channel, playlist, and experience defaults."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.channels.models import Channel, ChannelMembership
from apps.playlists.models import Playlist, PlaylistItem
from apps.tracks.models import Track


class Command(BaseCommand):
    help = "Create demo user (demo/demo1234), Demo Room, starter playlist, and sample experience."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="demo")
        parser.add_argument("--password", default="demo1234")

    def handle(self, *args, **options):
        User = get_user_model()
        username = options["username"]
        password = options["password"]
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@stream-music.local", "is_staff": False},
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created user {username}"))
        else:
            self.stdout.write(f"User {username} already exists")

        ch = Channel.objects.filter(owner=user, name="Demo Room").first()
        ch_created = ch is None
        if ch is None:
            ch = Channel.objects.create(
                owner=user,
                name="Demo Room",
                description="Demo channel — upload tracks or import_audio, then play a playlist.",
                privacy=Channel.Privacy.PUBLIC,
                experience={
                    "accent": "emerald",
                    "queue_end_mode": "loop",
                    "room_rules": "Be kind. One skip vote per person. Have fun.",
                    "suggestions_enabled": True,
                },
            )
        if ch_created:
            ChannelMembership.objects.get_or_create(
                channel=ch,
                user=user,
                defaults={"role": ChannelMembership.Role.OWNER, "is_active": True},
            )
            self.stdout.write(self.style.SUCCESS(f"Created channel #{ch.id} Demo Room"))

        pl = Playlist.objects.filter(owner=user, channel=ch, name="Starter Mix").first()
        if pl is None:
            pl = Playlist.objects.create(owner=user, channel=ch, name="Starter Mix")
            self.stdout.write(self.style.SUCCESS("Created Starter Mix playlist"))

        tracks = list(Track.objects.filter(owner=user).order_by("id")[:12])
        if tracks and not PlaylistItem.objects.filter(playlist=pl).exists():
            PlaylistItem.objects.bulk_create(
                [PlaylistItem(playlist=pl, track=t, position=i) for i, t in enumerate(tracks)]
            )
            self.stdout.write(self.style.SUCCESS(f"Added {len(tracks)} track(s) to Starter Mix"))
        elif not tracks:
            self.stdout.write("No tracks yet — run import_audio or upload from dashboard.")

        self.stdout.write(self.style.SUCCESS(f"Demo ready: channel /channel/{ch.id}"))
