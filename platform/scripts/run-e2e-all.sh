#!/usr/bin/env bash
# Run full Playwright E2E suite against isolated dev stack.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-stream-e2e}"
export COMPOSE_PROJECT_NAME

echo "Starting isolated dev stack (project: $COMPOSE_PROJECT_NAME)..."
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --force-recreate postgres redis backend

echo "Waiting for backend health..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8002/api/health >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Backend not healthy on :8002"
    exit 1
  fi
  sleep 2
done

docker compose -f docker-compose.yml -f docker-compose.e2e.yml exec -T backend python manage.py migrate --noinput

cd frontend-next
export DEV_REMOTE_ORIGIN=http://127.0.0.1:8002
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
export PLAYWRIGHT_API_URL=http://127.0.0.1:8002
export NEXT_PUBLIC_WS_BASE_URL=ws://127.0.0.1:8002

npx playwright test e2e/ --project=chromium --project=chromium-playback "$@"
