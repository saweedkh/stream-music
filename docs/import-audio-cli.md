# Importing audio from disk (`import_audio`)

Use this when you have audio files on the **same machine that runs Django** (or inside the same Docker container filesystem) and want them registered as **Track** rows under `MEDIA_ROOT`, without using the web upload UI.

## What it does

1. Walks a **source directory** you pass on the command line (recursively).
2. For each supported audio file, copies it into the media tree under:
   - `MEDIA_ROOT/audio/imports/<folder-slug>-<short-hash>/…`
   - Relative paths under the source folder are preserved.
3. Creates a **Track** in the database.

## Default visibility: `public_lan`

By default, imported tracks use **`public_lan`** visibility so **every authenticated user** can see them in `GET /api/tracks/` (same rule as other public LAN tracks).  
Use `--private` if tracks should belong only to the owner user until you share them manually.

## Supported extensions

`.mp3`, `.flac`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.webm`

## Usage (local)

```bash
cd backend-django
python manage.py import_audio "/absolute/path/to/your/music/folder"
```

### Options

| Flag | Description |
|------|-------------|
| `--owner USERNAME` | User who owns the `Track` rows (default: first active **superuser**). |
| `--dry-run` | Print what would be imported; no DB writes, no files saved under `MEDIA_ROOT`. |
| `--private` | Set `visibility=private` instead of `public_lan`. |

### Examples

```bash
# Preview
python manage.py import_audio "/data/incoming/albums" --dry-run

# Import as public library tracks owned by user `dj`
python manage.py import_audio "/data/incoming/albums" --owner dj

# Import as private to that user only
python manage.py import_audio "/data/incoming/albums" --owner dj --private
```

## Usage (Docker)

The backend container must **see** the source path. Typical options:

1. **Bind-mount** your music folder into the container (e.g. `/media/inbox`) and run:

   ```bash
   docker compose exec backend python manage.py import_audio /media/inbox --owner youruser
   ```

2. Or copy files into an existing mounted volume (e.g. the repo’s `./media` is often mounted at `/media` in `docker-compose.yml`) under a staging folder, then import from **inside** that mount path.

Ensure `MEDIA_ROOT` in the container points at the volume where you want files stored (see `backend-django/.env.example` — often `/media` in Docker).

## Idempotency

Imports are keyed by the **stored relative path** (`Track.file`). If a path already exists in the database, that file is **skipped** (reported as `skipped`).

## Related code

- Command: `backend-django/apps/tracks/management/commands/import_audio.py`
- Logic: `backend-django/apps/tracks/filesystem_import.py`
  - `import_audio_from_system_directory` — arbitrary host path → `MEDIA_ROOT` + `Track`
  - `import_audio_files_under_media` — scan only under `MEDIA_ROOT/audio/` (legacy / internal use)

## Sharing after import (`public_lan` vs `--private`)

- **`public_lan` (default):** no extra share rows needed; all logged-in users see the tracks in the API.
- **`--private`:** only the owner sees them until you add **Track share permissions** (users or channels) via the app’s Sharing UI or API.
