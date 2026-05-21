# E2E tests (Playwright)

## Specs

| File | Coverage |
|------|----------|
| `social-following-explore.spec.ts` | Following feed API/UI, Explore, user follow |
| `chat-reply.spec.ts` | Chat reply UI + WebSocket `reply_preview` + history API |
| `sync-two-clients.spec.ts` | Playback WS sync + two-browser queue/title sync |
| `suggestions-badge.spec.ts` | Pending suggestions API |
| `moderation.spec.ts` | Chat report + temp ban API |
| `join-request.spec.ts` | Private channel join approve |
| `resumable-upload.spec.ts` | Chunked upload init/status |
| `playback-channel.spec.ts` | Admin/listener audio (project `chromium-playback`) |

## Run (recommended)

From repo root, with Docker:

```bash
./scripts/run-e2e-all.sh
```

Social + chat only:

```bash
./scripts/run-e2e-social.sh
```

This starts an **isolated** Compose project (`stream-e2e`) on port **8002** (backend) and runs Playwright against **Next dev on :3000** with API rewrites (`chromium` + `chromium-playback`). WebSockets connect directly to `:8002` via `NEXT_PUBLIC_WS_BASE_URL` (Next rewrites do not upgrade WS). Helpers: `e2e/helpers/playback-ws.ts`, `e2e/helpers/chat-ws.ts`.

## Manual

```bash
COMPOSE_PROJECT_NAME=stream-e2e docker compose up -d postgres redis backend
# wait for http://127.0.0.1:8002/api/health

cd frontend-next
export DEV_REMOTE_ORIGIN=http://127.0.0.1:8002
export PLAYWRIGHT_API_URL=http://127.0.0.1:8002
export NEXT_PUBLIC_WS_BASE_URL=ws://127.0.0.1:8002
npm run test:e2e:social
```

Do not use port **8080** if the production Caddy container is running without the dev `backend` service on the same network — API calls will return empty responses.

## Rate limits

Auth register/login are capped at 10/min per IP in production. The E2E Compose overlay sets `E2E_RATE_LIMIT_OFF=1` on the backend. If you see `429 rate_limited` in tests, recreate the stack:

```bash
COMPOSE_PROJECT_NAME=stream-e2e docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --force-recreate backend
```

## CSRF

`GET /api/auth/csrf` returns `{ "csrfToken": "..." }` so API tests work without relying on cookie jars across origins.

## Backend unit test (chat reply)

```bash
docker compose exec backend python manage.py test apps.channels.tests.test_chat_reply
```
