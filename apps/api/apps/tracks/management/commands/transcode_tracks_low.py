"""Batch-generate file_low for tracks missing a low-bitrate copy."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.tracks.models import Track
from apps.tracks.services.transcode import transcode_track_low


class Command(BaseCommand):
    help = "Transcode tracks to file_low via ffmpeg (skips when ffmpeg missing)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=50)
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **options):
        limit = max(1, int(options["limit"]))
        force = bool(options["force"])
        qs = Track.objects.exclude(file="").order_by("-id")
        if not force:
            qs = qs.filter(file_low="")
        done = 0
        for track in qs[:limit]:
            if transcode_track_low(track.id, force=force):
                done += 1
                self.stdout.write(f"OK track {track.id}")
        self.stdout.write(self.style.SUCCESS(f"Transcoded {done} track(s)"))
