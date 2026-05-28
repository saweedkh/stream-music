# Stream Music — common dev commands
# See docs/project-structure.md

.PHONY: help dev dev-web dev-api lint lint-web lint-api test test-web test-api test-e2e build build-web new-feature new-domain

help:
	@echo "Targets:"
	@echo "  make dev          - docker compose up"
	@echo "  make dev-web      - Next.js dev server"
	@echo "  make lint         - lint web + api"
	@echo "  make test         - unit tests (web + api)"
	@echo "  make test-e2e     - Playwright social suite"
	@echo "  make build-web    - production Next.js build"
	@echo "  make new-feature NAME=<slug>  - scaffold frontend feature"
	@echo "  make new-domain NAME=<slug>   - scaffold Django domain app"

dev:
	docker compose up --build

dev-web:
	cd frontend-next && npm run dev

dev-api:
	cd backend-django && .venv/bin/daphne -b 0.0.0.0 -p 8000 config.asgi:application

lint: lint-web lint-api

lint-web:
	cd frontend-next && npm run lint

lint-api:
	cd backend-django && ruff check .

test: test-web test-api

test-web:
	cd frontend-next && npm test

test-api:
	cd backend-django && python manage.py test apps --verbosity=1

test-e2e:
	cd frontend-next && npm run test:e2e:social

build-web:
	cd frontend-next && npm run build

new-feature:
	@test -n "$(NAME)" || (echo "Usage: make new-feature NAME=my-domain" && exit 1)
	@bash tooling/scripts/new-feature.sh "$(NAME)"

new-domain:
	@test -n "$(NAME)" || (echo "Usage: make new-domain NAME=my_domain" && exit 1)
	@bash tooling/scripts/new-domain.sh "$(NAME)"
