# RetroPriceBR Monorepo

This repository bootstraps the MVP infrastructure for the Retro-Brazil Price Index. It is an npm workspace-based monorepo that hosts the Next.js web application, background worker, and supporting packages.

## Repository layout

```
datasets/                 # Reference CSV datasets used by the seeding scripts
docs/                     # Engineering conventions and secret-management notes
infra/
  docker-compose.yml      # Local infrastructure stack (db, cache, object storage, app workers)
packages/
  shared/                 # Cross-cutting types and constants
  core/                   # Domain logic (parsing, confidence scoring helpers)
  db/                     # Database utilities, migrations, and seeding scripts
  webapp/                 # Next.js application (app router + API routes)
  worker/                 # BullMQ worker and background jobs
Makefile                  # Local automation entrypoints
drizzle.config.ts         # Drizzle kit configuration
```

## Local development

```bash
npm install               # install all workspace dependencies
npm run dev:web           # start Next.js in Turbopack dev mode
npm run dev:worker        # run the BullMQ worker in watch mode
```

Useful scripts:

```bash
npm run build             # build shared/core/db + webapp + worker
npm run lint              # lint (currently focused on the webapp)
npm run verify            # lint + test + build (CI parity)
```

## Makefile shortcuts

```bash
make setup-local          # install dependencies and build all workspaces
make build                # run the monorepo build
make run-docker           # build images, wait for db, then launch webapp + worker
make setup-db-docker      # run migrations and dataset seeding against the docker stack
make stop-docker          # tear the compose stack down
make clean-local          # remove build artifacts and Next.js cache
make verify               # lint + test + build via npm run verify
```

Docker flows rely on Postgres being reachable at `tcp:127.0.0.1:5432`. Override the wait target with `DB_WAIT_TARGET=tcp:host.docker.internal:5432` (or any compatible endpoint) when running from WSL/macOS. Database scripts continue to accept `DATABASE_URL` overrides as needed.

Set environment variables via `.env` files or the compose file. Review `infra/docker-compose.yml` for the minimal set required to boot the stack.

## Engineering references

- `docs/engineering/conventions.md` – naming, API style, and schema guidance
- `docs/engineering/secrets.md` – environment variable & secret handling strategy
