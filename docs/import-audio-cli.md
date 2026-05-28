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
cd apps/api
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

The backend process must **read** the source folder and **write** under `MEDIA_ROOT` (in prod that is the `media_data` volume at `/media`). Your **database** must be the same one the stack uses (don’t run `manage.py` from a local venv against `localhost` unless Postgres credentials and DB match that stack — the usual failure is `password authentication failed for user "stream_music"`).

### Production stack (`docker-compose.prod.yml`)

One-shot import without changing the running backend container (bind-mounts only for this command):

```bash
cd /path/to/stream-music

docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml run --rm \
  -v "/ABSOLUTE/PATH/TO/YOUR/MUSIC:/inbox:ro" \
  backend python manage.py import_audio /inbox --owner YOUR_USERNAME
```

Or use the helper:

```bash
chmod +x deploy/import-audio.sh   # once
./deploy/import-audio.sh "/ABSOLUTE/PATH/TO/YOUR/MUSIC" --owner YOUR_USERNAME
```

`YOUR_USERNAME` must exist in **that** database (create a superuser inside the backend container if needed: `docker compose … exec backend python manage.py createsuperuser`).

Files are copied into `/media` inside the container (persisted in the `media_data` volume); nginx already serves `/audio/` from that volume.

### Dev stack (`docker-compose.yml`)

1. Bind-mount your music folder (e.g. under `./media/inbox`) **or** copy into the repo `./media` tree, then:

   ```bash
   docker compose exec backend python manage.py import_audio /media/inbox --owner youruser
   ```

2. Ensure `MEDIA_ROOT` in the container matches where you’re writing (see `apps/api/.env.example`).

## Idempotency

Imports are keyed by the **stored relative path** (`Track.file`). If a path already exists in the database, that file is **skipped** (reported as `skipped`).

## Related code

- Command: `apps/api/apps/tracks/management/commands/import_audio.py`
- Logic: `apps/api/apps/tracks/filesystem_import.py`
  - `import_audio_from_system_directory` — arbitrary host path → `MEDIA_ROOT` + `Track`
  - `import_audio_files_under_media` — scan only under `MEDIA_ROOT/audio/` (legacy / internal use)

## Sharing after import (`public_lan` vs `--private`)

- **`public_lan` (default):** no extra share rows needed; all logged-in users see the tracks in the API.
- **`--private`:** only the owner sees them until you add **Track share permissions** (users or channels) via the app’s Sharing UI or API.
