DOCKER_COMPOSE = docker compose -f infra/docker-compose.yml
DATABASE_URL ?= postgresql://app:app@localhost:5432/app
CROSS_ENV = npx cross-env
WAIT_ON = npx wait-on
DB_WAIT_TARGET ?= tcp:127.0.0.1:5432

.PHONY: help install build clean run-docker run-docker-detached docker-logs stop-docker db-migrate db-seed db-setup lint test verify

help:
	@echo "Available targets:"
	@echo "  make install              # install npm dependencies"
	@echo "  make build                # build all workspaces"
	@echo "  make run-docker           # bring up infra, apply migrations, start web & worker"
	@echo "  make run-docker-detached  # alias for run-docker (kept for compatibility)"
	@echo "  make docker-logs          # tail docker compose logs"
	@echo "  make stop-docker          # stop docker compose stack"
	@echo "  make db-migrate           # run database migrations"
	@echo "  make db-seed              # seed the database"
	@echo "  make db-setup             # alias for run-docker"
	@echo "  make lint                 # run lint across workspaces"
	@echo "  make test                 # run the default test suite"
	@echo "  make verify               # lint + build (CI parity)"

install:
	npm install

build:
	npm run build

clean:
	rm -rf apps/web/.next
	rm -rf packages/*/dist
	rm -f packages/*/tsconfig.tsbuildinfo
	rm -rf apps/worker/dist

run-docker:
	$(DOCKER_COMPOSE) up --build -d db cache objectstore
	$(WAIT_ON) $(DB_WAIT_TARGET)
	$(DOCKER_COMPOSE) run --rm db_setup
	$(DOCKER_COMPOSE) up --build -d web worker

run-docker-detached: run-docker
	@echo "Stack is running in background."

docker-logs:
	$(DOCKER_COMPOSE) logs -f

stop-docker:
	$(DOCKER_COMPOSE) down

db-migrate:
	$(CROSS_ENV) DATABASE_URL=$(DATABASE_URL) npm run db:migrate

db-seed:
	$(CROSS_ENV) DATABASE_URL=$(DATABASE_URL) npm run db:seed

db-setup: run-docker
	@echo "Database migrations and seeds completed via docker stack."

lint:
	npm run lint

test:
	npm run test

verify:
	npm run verify
