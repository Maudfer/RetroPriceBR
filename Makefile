DOCKER_COMPOSE = docker compose -f infra/docker-compose.yml

.PHONY: help install build clean run-docker run-docker-detached stop-docker db-migrate db-seed db-setup lint

help:
	@echo "Available targets:"
	@echo "  make install              # install npm dependencies"
	@echo "  make build                # build all workspaces"
	@echo "  make run-docker           # build and run docker compose stack"
	@echo "  make run-docker-detached  # run docker compose stack in background"
	@echo "  make stop-docker          # stop docker compose stack"
	@echo "  make db-migrate           # run database migrations"
	@echo "  make db-seed              # seed the database"
	@echo "  make db-setup             # run migrations and seeds"
	@echo "  make lint                 # lint the web application"

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
	$(DOCKER_COMPOSE) up --build

run-docker-detached:
	$(DOCKER_COMPOSE) up --build -d

stop-docker:
	$(DOCKER_COMPOSE) down

db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

db-setup:
	npm run db:setup

lint:
	npm run lint:web
