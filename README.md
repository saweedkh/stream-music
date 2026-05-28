# Stream Music

A self-hosted, real-time synchronized group music playback platform. Multiple users join **channels** and listen to the same audio in sync, with sub-second drift correction via WebSockets. Includes chat, playlists, queue management, reactions, moderation tools, and social features.

## Architecture

```
Browser/App  ──►  Nginx (TLS + static audio)  ──►  Next.js (SSR + UI)  ──►  Django/Daphne (API + WS)
                        │                                                         │
                        ├── /audio/* (static files)                               ├── PostgreSQL 16
                        └── /ws/* (proxy to Daphne)                               ├── Redis 7 (pub/sub)
                                                                                  └── Celery (background tasks)
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS, Radix UI, Zustand |
| Backend | Django 4.2, Django REST Framework, Django Channels (Daphne) |
| Database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7 |
| Background Tasks | Celery 5 |
| Error Tracking | Sentry (optional) |
| Native Apps | Capacitor 7 (Android + iOS WebView) |
| Deployment | Docker Compose, rsync to VPS, Certbot TLS |

## Features

- **Synchronized playback** — sub-second drift correction across all listeners
- **Channels** — public, private, unlisted rooms with join/approval workflows
- **Queue system** — reorder, upvote, shuffle, play-next, queue-end modes (loop/stop/repeat)
- **Real-time chat** — send, edit, delete, reply, react, pin, slow mode, word filters
- **Playlists** — create, share via link, copy to channel, import
- **Chunked uploads** — resumable uploads up to 500 MB
- **Moderation** — chat bans, report system, audit logs, role-based permissions
- **Push notifications** — Web Push (VAPID), no third-party service required
- **Discovery** — explore feed, global search, user profiles, follow channels/users
- **Admin panel** — user management, badge system, channel oversight, health checks
- **Support tickets** — built-in helpdesk with real-time WebSocket updates
- **PWA** — installable, service worker for push notifications
- **Party recap** — session heatmap and playback history visualization

## Quick Start (Development)

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.12+ (for local backend dev)

### Makefile shortcuts

```bash
make help          # list targets
make dev-web       # Next.js dev
make lint          # web + api
make build-web     # production build
make new-feature NAME=my-domain   # scaffold features/<name>/
```

### 1. Clone & configure

```bash
git clone <repo-url> && cd stream-music
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local  # optional for local npm run dev
```

### 2. Start the stack

```bash
docker compose up --build
```

### 3. Open the app

- **http://localhost:8080** — main app (via nginx)
- **https://localhost:8443** — HTTPS (self-signed cert for LAN testing)
- **http://localhost:3000** — Next.js dev server (direct)

Migrations run automatically on container startup.

### Local development (without Docker)

```bash
# Backend
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application

# Frontend
cd apps/web
npm ci
npm run dev
```

## Production Deployment

Full guide: **[docs/production-deployment.md](docs/production-deployment.md)**

```bash
cp deploy/env.production.example .env.production
# Edit SECRET_KEY, POSTGRES_PASSWORD, SITE_DOMAIN
./deploy/up.sh
```

The deploy stack includes:
- TLS via Certbot (Let's Encrypt)
- Nginx reverse proxy with static audio serving
- Celery worker for background tasks
- Automatic migrations on startup

### CI/CD

- **CI** runs on every push: ruff lint, TypeScript checks, ESLint, Django checks, backend tests, Playwright E2E
- **CD** deploys to production via rsync on push to `main` (requires `DEPLOY_SSH_KEY` secret)
- **Backup** runs daily at 3 AM UTC (cron) with artifact retention

## Project Structure

**Full architecture guide (target layout, conventions, migration):** **[docs/project-structure.md](docs/project-structure.md)**  
**Day-to-day conventions:** [docs/CONVENTIONS.md](docs/CONVENTIONS.md) · **ADRs:** [docs/adr/](docs/adr/)

```
stream-music/
├── apps/api/           # Django project
│   ├── apps/
│   │   ├── channels/         # Channel, Membership, Chat, Invite, Moderation
│   │   ├── common/           # Auth, Admin, Social, Support, Discovery
│   │   ├── playback/         # PlaybackSession, Events, WS consumers
│   │   ├── playlists/        # Playlist, Queue models
│   │   └── tracks/           # Track, chunked upload, share permissions
│   └── config/               # Settings, URLs, ASGI, Celery, middleware
├── apps/web/            # Next.js app
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   ├── components/       # UI primitives (shadcn/Radix)
│   │   ├── features/         # Feature modules (auth, channels, player, etc.)
│   │   ├── hooks/            # WebSocket, presence, hotkeys
│   │   └── lib/              # API client, i18n, utilities
│   ├── e2e/                  # Playwright E2E tests
│   └── public/               # PWA manifest, service worker
├── deploy/                   # Production deployment scripts
├── scripts/                  # Backup, VAPID key generation
├── docs/                     # Architecture, conventions, ADRs, runbooks
└── .github/workflows/        # CI/CD pipelines
```

See [docs/project-structure.md](docs/project-structure.md) for the target `apps/` + `domains/` layout and feature module template.

## API Overview

### REST API (`/api/`)

| Group | Endpoints |
|-------|-----------|
| Auth | `csrf`, `register`, `login`, `logout`, `me`, `me/password`, `me/notification-settings`, `me/push-subscription` |
| Channels | CRUD, `state`, `control`, `join`, `leave`, `close`, `reopen`, `invite`, `members`, `settings`, `queue`, `chat`, `suggestions` |
| Tracks | CRUD, chunked upload (`init`, `chunk`, `finalize`), `share-permissions`, `facets` |
| Playlists | CRUD, `playlist-items`, `add-tracks`, `copy-to-channel`, `share` |
| Admin | `overview`, `users`, `badges`, `channels`, `health` |
| Support | `categories`, `tickets`, `messages`, `staff-users` |
| Discovery | `explore`, `search/global`, user profiles, channel/user follows |

### WebSocket

| Endpoint | Purpose |
|----------|---------|
| `ws/channels/{id}` | Playback sync + control events |
| `ws/channels/{id}/chat` | Real-time text chat |
| `ws/support/tickets/{id}` | Support ticket updates |

### Sync Contract

UI control actions go to `POST /api/channels/{id}/control`. The backend updates playback state and emits a WS event to all channel members with:
- `type` — `PLAY`, `PAUSE`, `SEEK`, `NEXT`, `PREV`
- `server_time`, `started_at_server_time`, `position`, `is_playing`, `queue_version`

## Web Push Notifications

Uses **Web Push + VAPID** (no Firebase/OneSignal required). Keys are pre-filled in `.env.example` for development.

| Variable | Where |
|----------|-------|
| `WEBPUSH_VAPID_PUBLIC_KEY` / `PRIVATE_KEY` | Django `.env` |
| `NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY` | Next.js `.env.local` |
| `FRONTEND_BASE_URL` | Django — base URL for notification click links |

Generate new keys: `bash scripts/generate-vapid-keys.sh`

## Import Audio from Disk

Bulk-register audio files from a server folder:

```bash
docker compose exec backend python manage.py import_audio /path/to/music --owner yourusername
```

See **[docs/import-audio-cli.md](docs/import-audio-cli.md)** for details.

## Testing

```bash
# Backend unit tests
cd apps/api && python manage.py test --verbosity=2

# Frontend unit tests
cd apps/web && npm test

# E2E tests (Playwright)
cd apps/web && npm run test:e2e
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `dev-secret` | Django secret key |
| `DEBUG` | `0` | Enable debug mode |
| `POSTGRES_*` | `stream_music` | Database credentials |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `SENTRY_DSN` | *(empty)* | Sentry error tracking DSN |
| `CELERY_BROKER_URL` | *(from REDIS_URL)* | Celery broker |
| `CORS_EXTRA_ORIGINS` | *(empty)* | Additional CORS origins (comma-separated) |
| `TRUST_LAN_CSRF` | `0` | Allow private IP CSRF bypass for LAN |

## Mirrors (Iran)

```
Python:  https://pypi.devneeds.ir/simple/
NPM:     https://npm.devneeds.ir/
Docker:  https://docker.devneeds.ir  (daemon registry mirror)
```

## License

Private project — all rights reserved.
