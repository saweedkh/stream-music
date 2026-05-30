# Stream Music — common dev commands
# See docs/project-structure.md

.PHONY: help dev ensure-env dev-web dev-api lint lint-web lint-api lint-api-format lint-web-types check-quality pre-commit-install pre-commit test test-web test-api test-e2e build build-web new-feature new-domain openapi-export

help:
	@echo "Targets:"
	@echo "  make dev          - ensure .env files + docker compose up"
	@echo "  make ensure-env   - copy .env.example -> .env if missing"
	@echo "  make dev-web      - Next.js dev server"
	@echo "  make lint              - lint web + api (ruff check + next lint)"
	@echo "  make check-quality     - full local gate (lint + format + tsc)"
	@echo "  make pre-commit-install - install git hooks"
	@echo "  make pre-commit        - run all pre-commit hooks"
	@echo "  make test              - unit tests (web + api)"
	@echo "  make test-e2e     - Playwright social suite"
	@echo "  make build-web    - production Next.js build"
	@echo "  make new-feature NAME=<slug>  - scaffold frontend feature"
	@echo "  make new-domain NAME=<slug>   - scaffold Django domain app"

ensure-env:
	@test -f apps/api/.env || (cp apps/api/.env.example apps/api/.env && echo "Created apps/api/.env from .env.example")
	@test -f apps/web/.env.local || (cp apps/web/.env.example apps/web/.env.local && echo "Created apps/web/.env.local from .env.example")

dev: ensure-env
	docker compose up --build

dev-web:
	cd apps/web && npm run dev

dev-api:
	cd apps/api && .venv/bin/daphne -b 0.0.0.0 -p 8000 config.asgi:application

lint: lint-web lint-api

lint-web:
	cd apps/web && npm run lint

lint-api:
	cd apps/api && .venv/bin/ruff check .

lint-api-format:
	cd apps/api && .venv/bin/ruff format --check .

lint-web-types:
	cd apps/web && npx tsc --noEmit

check-quality: lint lint-api-format lint-web-types

pre-commit-install:
	@test -x apps/api/.venv/bin/pip || (echo "Create venv: cd apps/api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt" && exit 1)
	apps/api/.venv/bin/pip install -r requirements-dev.txt -r ../requirements-dev.txt
	apps/api/.venv/bin/pre-commit install
	@echo "Git hooks installed. Run 'make pre-commit' to verify."

PRE_COMMIT := $(wildcard apps/api/.venv/bin/pre-commit)

pre-commit:
	$(if $(PRE_COMMIT),$(PRE_COMMIT),pre-commit) run --all-files

test: test-web test-api

test-web:
	cd apps/web && npm test

test-api:
	cd apps/api && \
	POSTGRES_HOST=localhost \
	POSTGRES_PORT=5431 \
	POSTGRES_USER=stream_music \
	POSTGRES_PASSWORD=stream_music \
	POSTGRES_DB=stream_music \
	.venv/bin/python manage.py test apps --verbosity=1

test-e2e:
	cd apps/web && npm run test:e2e:social

# Full Playwright suite against local stack (requires E2E_RATE_LIMIT_OFF on API — see docker-compose.e2e.yml)
test-e2e-all:
	cd apps/web && PLAYWRIGHT_BASE_URL=$${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080} \
		PLAYWRIGHT_API_URL=$${PLAYWRIGHT_API_URL:-http://127.0.0.1:8080} \
		npm run test:e2e:all

build-web:
	cd apps/web && npm run build

new-feature:
	@test -n "$(NAME)" || (echo "Usage: make new-feature NAME=my-domain" && exit 1)
	@bash tooling/scripts/new-feature.sh "$(NAME)"

new-domain:
	@test -n "$(NAME)" || (echo "Usage: make new-domain NAME=my_domain" && exit 1)
	@bash tooling/scripts/new-domain.sh "$(NAME)"

openapi-export:
	@bash tooling/scripts/export-openapi-schema.sh
