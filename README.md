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
make run-docker     # build infra, apply migrations/seeds, then launch web+worker
make docker-logs    # stream docker compose logs
make build          # build web, worker, and supporting packages
make db-setup       # alias for run-docker (kept for convenience)
make stop-docker    # tear everything back down
```

Run targets rely on the Postgres container being reachable at `tcp:127.0.0.1:5432`; override with
`DB_WAIT_TARGET=tcp:host.docker.internal:5432` (or similar) if needed. Manual database commands such
as `make db-migrate` and `make db-seed` still accept a `DATABASE_URL` override.

Set environment variables via `.env` files or the Docker Compose file. See `infra/docker-compose.yml` for the minimum set.
