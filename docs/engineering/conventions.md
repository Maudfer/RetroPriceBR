# Engineering Conventions

The MVP leans on a TypeScript-first mono-repo. To keep collaboration smooth, use the conventions below unless we explicitly agree on a change.

## General Principles
- Prefer small, composable modules inside `packages/` that expose clear interfaces.
- Treat the worker and web apps as thin shells around shared domain logic; do not duplicate business rules.
- Avoid silent failures: bubble up domain errors with typed error helpers and map them to HTTP responses at the edge.
- Keep code documented with focused JSDoc/TSdoc blocks only when intent is non-obvious.

## Naming
- Files and directories: `kebab-case` for routes/pages, `camelCase` for helper modules, `PascalCase` for React components and classes.
- Database tables: `snake_case` plural nouns (e.g. `game_listings`). Columns use `snake_case`. Enums are uppercase with underscores (`STORE_PHYSICAL`).
- Shared TypeScript types exported from `@retroprice/shared` use `PascalCase` (e.g. `PurchaseSource`). Enum literal strings remain uppercase with underscores to mirror DB values.
- Environment variables: uppercase + underscores, scoping with prefixes where meaningful (`JWT_`, `S3_`).

## API Design
- REST resources follow `/kebab-case` paths (`/game-prices`), but dynamic IDs rely on semantic identifiers (`/games/{slug}`) as described in the spec.
- Request/response bodies use `snake_case` keys to align with the spec and the database representation.
- Pagination parameters: `page`, `page_size` (default 25, max 100). Sorting via `sort` with allowed values enumerated per endpoint.
- Validation must happen at the edge using Zod schemas shared from `@retroprice/shared`. Return `{ "error": { "code": "...", "message": "..." } }` for failures.
- Apply rate limiting middleware to all mutating endpoints before hitting core logic.

## Database & Drizzle
- Use Drizzle schema definitions in `packages/db/src/schema`. One file per aggregate (e.g. `game.ts`, `purchase.ts`).
- Generate migrations via Drizzle kit and commit them under `packages/db/migrations` with deterministic timestamps.
- Always enable `pg_trgm` and `unaccent` extensions inside migration `000`.
- Seed data scripts belong in `packages/db/src/seeds` and should be idempotent.

## Git & Reviews
- Keep feature branches focused on one phase or vertical slice; rebase before opening a PR.
- Squash commits for feature branches unless the history tells a meaningful story (schema migrations, large refactors).
- Ensure `npm run verify` passes locally before pushing.
- When in doubt, update this document so the convention is discoverable.
