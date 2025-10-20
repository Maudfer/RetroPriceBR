# Secrets & Environment Strategy

All services rely on environment variables. The repository only ships examples—never commit real secrets.

## Local Development
- Copy `.env.example` to `.env.local` at the repository root. The Makefile and Docker Compose files automatically load it when present.
- Keep service-specific overrides (e.g. Next.js environment) under `apps/webapp/.env.local` only if a variable must be scoped to that app.
- Secrets required for third-party integrations (Google OAuth, S3 credentials) should be generated per developer and stored in your password manager.

## Docker & CI
- `infra/docker-compose.yml` reads dotenv files via Compose so we can supply `env_file` entries later. For now, the Makefile injects `DATABASE_URL` explicitly when needed.
- GitHub Actions obtains secrets from repository settings. Required values will be `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `CSRF_SECRET`, `REFRESH_TOKEN_SECRET`.

## Production Rollout
- Provision managed secrets (AWS Secrets Manager, Doppler, or Vault). Deployments must mount them as environment variables—never bake secrets into Docker images.
- Rotate JWT key pairs every 90 days. Expose the public keys via `/​.well-known/jwks.json` and keep old private keys available until their tokens expire.
- Bucket credentials should follow least privilege: worker requires write access to `incoming/`, `evidence/`, and `thumbs/`. Web only needs permission to create presigned URLs.
- Database credentials are scoped per environment (dev/staging/prod) with distinct users. Prefer read replicas for reporting workloads in later phases.

## Checklist Before Commit
- `.env*` files (except `.env.example`) remain ignored.
- Secrets do not appear in source control, docs, or issue trackers.
- Update this document whenever a new secret is introduced or an environment flow changes.
