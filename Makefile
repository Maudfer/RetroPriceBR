DOCKER_COMPOSE = docker compose -f infra/docker-compose.yml
DATABASE_URL ?= postgresql://app:app@localhost:5432/app
CROSS_ENV = npx cross-env
WAIT_ON = npx wait-on
DB_WAIT_TARGET ?= tcp:127.0.0.1:5432

.PHONY: help setup clean run-docker stop-docker db-setup lint test verify

help:
	@echo "Available targets:"
	@echo "  make setup                # install dependencies and build all workspaces locally"
	@echo "  make clean                # remove all build artifacts"
	@echo "  make run-docker           # leverage compose stack to bring up infra, start web & worker"
	@echo "  make stop-docker          # stop docker compose stack"
	@echo "  make db-setup             # run-docker, then run database setup scripts"
	@echo "  make lint                 # run lint across workspaces"
	@echo "  make test                 # run the default test suite"
	@echo "  make verify               # lint + build (CI parity)"

setup:
	npm install
	npm run build

clean:
	rm -rf apps/web/.next
	rm -rf packages/*/dist
	rm -f packages/*/tsconfig.tsbuildinfo
	rm -rf apps/worker/dist

run-docker:
	$(DOCKER_COMPOSE) build db_setup
	$(DOCKER_COMPOSE) up --build -d db cache objectstore
	$(WAIT_ON) $(DB_WAIT_TARGET)
	$(DOCKER_COMPOSE) run --rm db_setup
	$(DOCKER_COMPOSE) up --build -d web worker

stop-docker:
	$(DOCKER_COMPOSE) down

db-setup:
	$(DOCKER_COMPOSE) up --build -d db cache objectstore
	$(WAIT_ON) $(DB_WAIT_TARGET)
	$(DOCKER_COMPOSE) build db_setup
	$(DOCKER_COMPOSE) run --rm db_setup
	@echo "Database migrations and seeds completed via docker stack."

lint:
	npm run lint

test:
	npm run test

verify:
	npm run verify
