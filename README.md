# Stream Music

پلتفرم self-hosted برای پخش هم‌زمان موسیقی در اتاق‌های گروهی (کانال)، با همگام‌سازی WebSocket، چت، صف، پلی‌لیست و کشف محتوا.

## معماری

```text
Browser/PWA  →  Nginx (TLS, /audio)  →  Next.js  →  Django + Daphne (REST + WS)
                                              ├── PostgreSQL 16
                                              ├── Redis 7
                                              └── Celery
```

| لایه | فناوری |
|------|--------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind, Radix, Zustand |
| Backend | Django 4.2, DRF, Channels (Daphne) |
| Deploy | Docker Compose, nginx, Certbot |

## شروع سریع (توسعه)

```bash
git clone <repo-url> && cd stream-music
make ensure-env          # کپی .env از example در صورت نبود
docker compose up --build
```

- اپ: **http://localhost:8080** (nginx)
- HTTPS محلی: **https://localhost:8443**

توسعه بدون Docker:

```bash
# Backend
cd apps/api && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application

# Frontend
cd apps/web && npm ci && npm run dev
```

## Makefile

```bash
make help
make check-quality       # lint + ruff format + tsc
make test-api            # تست Django (Postgres روی localhost:5431)
make test              # Vitest + Django
make openapi-export    # openapi.snapshot.json
make new-feature NAME=foo
make new-domain NAME=foo
```

## مستندات

**فهرست کامل:** [docs/README.md](docs/README.md)

| سند | موضوع |
|-----|--------|
| [docs/project-structure.md](docs/project-structure.md) | ساختار repo و قراردادها |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | lint، commit، PR |
| [docs/api-endpoints.md](docs/api-endpoints.md) | REST API |
| [docs/realtime-contracts.md](docs/realtime-contracts.md) | WebSocket |
| [docs/production-deployment.md](docs/production-deployment.md) | استقرار پروداکشن |

## API و WebSocket

- REST تحت `/api/` — جزئیات: [docs/api-endpoints.md](docs/api-endpoints.md)
- WS کانال: `ws/channels/{id}` — جزئیات: [docs/realtime-contracts.md](docs/realtime-contracts.md)
- کنترل پخش: `POST /api/channels/{id}/control` → broadcast به همه اعضا

## تست

```bash
make test-api
cd apps/web && npm test
cd apps/web && npm run test:e2e    # Playwright — see apps/web/e2e/README.md
```

E2E با rate limit خاموش: `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d`

## استقرار پروداکشن

[docs/production-deployment.md](docs/production-deployment.md) — `./deploy/up.sh`، TLS، migrate خودکار.

## سایر

- Import ترک از دیسک: [docs/import-audio-cli.md](docs/import-audio-cli.md)
- اپ native (Capacitor): [docs/capacitor-native-app.md](docs/capacitor-native-app.md)
- Web Push: `bash scripts/generate-vapid-keys.sh`

## License

Private — all rights reserved.
