# RetroPriceBR Monorepo

This repository bootstraps the MVP infrastructure for the Retro-Brazil Price Index. It uses an npm workspace-based monorepo that hosts the Next.js web application, background worker, and shared packages.

## Structure

```
apps/
  web/       # Next.js web + API surface
  worker/    # BullMQ worker + cron entrypoint
packages/
  shared/    # Cross-cutting types and constants
  core/      # Domain logic (confidence, sanitization helpers)
  db/        # Database utilities and schema entrypoint
infra/
  docker-compose.yml
```

## Getting Started

```bash
npm install
npm run dev:web
npm run dev:worker
```

Docker usage:

```bash
docker compose -f infra/docker-compose.yml up --build
```

### Makefile shortcuts

```bash
make run-docker     # build + launch the full stack
make build          # build web, worker, and supporting packages
make db-setup       # run migrations followed by seeds
make stop-docker    # tear everything back down
```

Set environment variables via `.env` files or the Docker Compose file. See `infra/docker-compose.yml` for the minimum set.
