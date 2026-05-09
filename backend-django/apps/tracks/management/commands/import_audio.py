"""Import audio from a host filesystem folder into MEDIA_ROOT and register tracks."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.tracks.filesystem_import import import_audio_from_system_directory
from apps.tracks.models import Track

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Copy audio files from a folder on this machine into MEDIA_ROOT/audio/imports/… "
        "and create Track rows. Default visibility is public_lan (all logged-in users see them)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "source",
            type=str,
            help="Path to a folder containing audio files (e.g. /home/you/Music/inbox)",
        )
        parser.add_argument(
            "--owner",
            type=str,
            default="",
            help="Username who owns the imported tracks (default: first active superuser)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List files that would be imported without copying or saving",
        )
        parser.add_argument(
            "--private",
            action="store_true",
            help="Use visibility=private instead of public_lan",
        )

    def handle(self, *args, **options):
        source = options["source"]
        username = (options["owner"] or "").strip()
        dry_run = options["dry_run"]
        visibility = Track.Visibility.PRIVATE if options["private"] else Track.Visibility.PUBLIC_LAN

        if username:
            owner = User.objects.filter(username=username).first()
            if not owner:
                raise CommandError(f"User not found: {username}")
        else:
            owner = User.objects.filter(is_superuser=True, is_active=True).order_by("id").first()
            if not owner:
                raise CommandError("No active superuser found. Create one or pass --owner USERNAME")

        self.stdout.write(f"Owner: {owner.username} (id={owner.id})")
        self.stdout.write(f"Source: {source}")
        self.stdout.write(f"Visibility: {visibility}")
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — no files written"))

        result = import_audio_from_system_directory(owner, source, visibility=visibility, dry_run=dry_run)

        for row in result["created"]:
            tid = row.get("id")
            label = "would create" if tid is None else f"track #{tid}"
            self.stdout.write(self.style.SUCCESS(f"{label}: {row.get('file')} — {row.get('title')!r}"))
        for path in result["skipped"]:
            self.stdout.write(self.style.NOTICE(f"skipped (already in DB): {path}"))
        for err in result["errors"]:
            self.stdout.write(self.style.ERROR(f"error: {err}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. created={len(result['created'])}, skipped={len(result['skipped'])}, errors={len(result['errors'])}"
            )
        )
