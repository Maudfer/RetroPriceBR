DOCKER_COMPOSE = docker compose -f infra/docker-compose.yml
DATABASE_URL ?= postgresql://app:app@localhost:5432/app
CROSS_ENV = npx cross-env
WAIT_ON = npx wait-on
DB_WAIT_TARGET ?= tcp:127.0.0.1:5432

.PHONY: help setup-local clean-local build run-db-docker run-docker stop-docker setup-db-docker lint test verify

help:
	@echo "Available targets:"
	@echo "  make setup-local          # install dependencies and build all workspaces locally"
	@echo "  make clean-local          # remove all build artifacts"
	@echo "  make build                # run the monorepo build"
	@echo "  make run-docker           # leverage compose stack to bring up infra, start webapp & worker"
	@echo "  make stop-docker          # stop docker compose stack"
	@echo "  make setup-db-docker      # run database setup against docker services"
	@echo "  make lint                 # run lint across workspaces"
	@echo "  make test                 # run the default test suite"
	@echo "  make verify               # lint + build (CI parity)"

setup-local:
	npm install
	npm run build

clean-local:
	rm -rf packages/webapp/.next
	rm -rf packages/*/dist
	rm -f packages/*/tsconfig.tsbuildinfo
	rm -rf packages/worker/dist

build:
	npm run build

run-db-docker:
	$(DOCKER_COMPOSE) up --build -d db cache objectstore
	$(WAIT_ON) $(DB_WAIT_TARGET)
	@echo "Database services are up and running."

run-docker: run-db-docker
	$(DOCKER_COMPOSE) up --build -d webapp worker

setup-db-docker: run-db-docker
	$(DOCKER_COMPOSE) build db_setup
	$(DOCKER_COMPOSE) run --rm db_setup
	@echo "Database migrations and seeds completed via docker stack."

stop-docker:
	$(DOCKER_COMPOSE) down

lint:
	npm run lint

test:
	npm run test

verify:
	npm run verify
