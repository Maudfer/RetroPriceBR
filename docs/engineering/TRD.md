# RetroPriceBR

## Project Overview

**RetroPriceBR** is a community-driven website designed to track, aggregate, and visualize market prices for retro video games and consoles sold in Brazil. Inspired by the U.S. site *pricecharting.com*, it focuses on Brazilian marketplaces and live-selling environments (e.g., YouTube, Mercado Livre, OLX, Shopee, and independent stores).

The site relies on **user-submitted sale data**, verified through image or link evidence, to calculate reliable median prices and historical trends. Since most retro game sales in Brazil occur through informal channels and live streams, the platform emphasizes **transparency**, **community validation**, and **data confidence scores** instead of centralized moderation.

### Core Features

- **Game and Console Databases**: Seeded from public sources (e.g., IGDB), providing SKU-level organization for accurate categorization.
- **User Submissions**: Logged-in users can submit verified sales with proof (screenshots, links, or photos). Each submission contributes to aggregate price calculations.
- **Confidence Algorithm**: A transparent scoring system weights data credibility based on user reputation, source type, and peer validation.
- **Community Governance**: Reputation and trust-based permissions allow experienced users to merge duplicates or downvote suspicious data.
- **Evidence Sanitization**: Uploaded images are automatically scanned for personal data (CPF, email, etc.), blurred or rejected to maintain LGPD compliance.
- **Price Visualization**: Dynamic median and confidence charts per game/condition, separated by source type (Livestream, Marketplace, Store, Individual).
- **Public Profiles and Transparency**: All user actions, votes, and submissions are publicly visible, creating a verifiable trail of data provenance.

The MVP aims for simplicity, focusing on scalability and transparency rather than moderation. Future versions may include cross-verification between buyers/sellers, data API for third parties, and store dashboards.

--- – MVP Implementation Guide

Last update: 2025-10-19

---

## Architecture Overview

This MVP will be developed in a **mono‑repo** with Docker Compose. The stack prioritizes simplicity and observability while keeping production-readiness in mind.

### Services (containers)

| Service | Tech | Role |
|---|---|---|
| **webapp** | Next.js (Node 20) | Serves the website (SSR) **and** the HTTP API (REST). Hosts auth endpoints, business logic, and presigned-upload endpoints. Can also run light jobs (webhooks) but **not** heavy workers.
| **worker** | Node 20 + BullMQ | Background jobs: image sanitization, OCR, pHash, duplicate checks, nightly price aggregation, reputation updates. Consumes queues from Valkey/Redis.
| **db** | PostgreSQL 15 | Primary database. Enable `pg_trgm` and `unaccent` extensions for search and de-dup heuristics.
| **cache** | Valkey (Redis-compatible) | Queues (BullMQ), rate limit token buckets, short-lived HTTP cache, idempotency keys.
| **objectstore** | Localstack (S3) | Buckets for `evidence-original` (optional), `evidence-sanitized`, `thumbs`. In prod, switch to real S3 or a compatible store.
| **db_setup** | Node 20 | Helper container that runs migrations + dataset seeders once the database is reachable.
| **imgproxy** (optional) | imgproxy or thumbor | On-the-fly resizing/cropping with signed URLs (can be skipped if you generate thumbs during sanitization).
| **scheduler** | Node + cron | Kicks off nightly jobs if you prefer a dedicated container (or use `worker` + node-cron).
| **otel/jaeger** (optional) | OpenTelemetry + Jaeger | Local tracing to debug slow queries and image jobs.

> You can omit `imgproxy`, `scheduler` and `jaeger` in the very first commit and add them later.

### Repository layout
```
/ datasets                 # Raw CSVs (PlayMyData, RetroGames) used for local seeding
/ docs
  /engineering             # Conventions, secrets guide, TRD (this file)
/ infra
  docker-compose.yml       # Local infra stack (db, cache, objectstore, app containers)
/ packages
  /shared                  # Cross-cutting types, DTOs, Zod schemas
  /core                    # Domain logic (confidence math, sanitizers)
  /db                      # Database schema, migrations, seeding scripts
  /webapp                  # Next.js app (app router + API routes)
  /worker                  # BullMQ workers + cron entrypoints
Makefile                   # Local automation entrypoints
package.json               # npm workspaces definition
```

### Docker Infrastructure (skeleton)
```yaml
services:
  db:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  cache:
    image: valkey/valkey:7
    restart: unless-stopped
    ports:
      - "6379:6379"

  objectstore:
    image: localstack/localstack:latest
    restart: unless-stopped
    environment:
      - SERVICES=s3
      - DEBUG=0
    ports:
      - "4566:4566"
    volumes:
      - localstack:/var/lib/localstack
      - /var/run/docker.sock:/var/run/docker.sock

  db_setup:
    build:
      context: ..
      dockerfile: packages/db/Dockerfile
    restart: "no"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://app:app@db:5432/app
    command: [ "sh", "-c", "npx wait-on tcp:db:5432 && node packages/db/dist/scripts/setup.js" ]

  webapp:
    build:
      context: ..
      dockerfile: packages/webapp/Dockerfile
    restart: unless-stopped
    depends_on:
      - db
      - cache
      - objectstore
    environment:
      DATABASE_URL: postgresql://app:app@db:5432/app
      REDIS_URL: redis://cache:6379
      S3_ENDPOINT: http://objectstore:4566
      S3_REGION: us-east-1
      S3_ACCESS_KEY_ID: test
      S3_SECRET_ACCESS_KEY: test
      EVIDENCE_BUCKET: evidence-sanitized
      THUMBS_BUCKET: evidence-thumbs
      JWT_JWKS_URI: http://webapp:3000/.well-known/jwks.json
      NEXT_PUBLIC_API_URL: http://localhost:3000
    ports:
      - "3000:3000"

  worker:
    build:
      context: ..
      dockerfile: packages/worker/Dockerfile
    restart: unless-stopped
    depends_on:
      - db
      - cache
      - objectstore
    environment:
      DATABASE_URL: postgresql://app:app@db:5432/app
      REDIS_URL: redis://cache:6379
      S3_ENDPOINT: http://objectstore:4566
      S3_REGION: us-east-1
      S3_ACCESS_KEY_ID: test
      S3_SECRET_ACCESS_KEY: test
      EVIDENCE_BUCKET: evidence-sanitized
      THUMBS_BUCKET: evidence-thumbs

volumes:
  pgdata:
  localstack:
```

### Environment variables (minimum)
- **Database**: `DATABASE_URL`
- **Cache/Queue**: `REDIS_URL`
- **Object store**: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `EVIDENCE_BUCKET`, `THUMBS_BUCKET`
- **Auth**: `JWT_PRIVATE_KEY` (PEM), `JWT_PUBLIC_KEY` (PEM) or JWKS key store; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_REDIRECT_URI`
- **Security**: `REFRESH_TOKEN_SECRET`, `CSRF_SECRET`, `RATE_LIMIT_RPM`
- **Image rules**: `MAX_UPLOAD_MB` (default 1), `MAX_WIDTH_PX` (480), `OCR_ENABLED=true|false`

### Networking & security (dev)
- Expose only `web:3000` publicly.
- Other containers communicate over the default compose network.
- For Localstack S3, bootstrap buckets on startup using an entrypoint script or `awslocal s3 mb s3://evidence-sanitized`.

### Data flow (evidence)
1. **Client** requests presigned URL from `web` (`/evidence/upload`).
2. Upload goes to `objectstore` (Localstack/S3) → put object with temporary key in `incoming/`.
3. `worker` listens to a queue message (published by `web` after creating `Purchase`) and runs the **sanitization pipeline**:
   - Download `incoming/*` → convert to WebP (Sharp), max width 480 px.
   - Strip EXIF.
   - Run OCR (Tesseract) → regex scan for CPF/phone/email. If PII → **reject** and delete object.
   - Compute perceptual hash (pHash);
   - Move sanitized file to `evidence/` and generate `thumbs/`.
   - Update Purchase: `evidence_thumb_url`, `status=active`, `confidence_raw`.
4. If rejection → set `status=rejected` and notify user.

### Background jobs
- **Nightly Aggregation**: compute medians/IQR/confidence per listing (last 180 days) → write `GamePrice`/`ConsolePrice` snapshots.
- **Reputation Update**: adjust scores from likes/fraud flags; auto-upgrade to `curator` at thresholds.
- **Cleanup**: purge orphaned uploads in `incoming/` older than 24h.

### Caching strategy
- **HTTP GET** for game/console pages: cache 60s in Valkey with cache keys: `game:{slug}:purchases:{hash(filters)}`.
- **Rate limiting**: token-bucket per IP and per user using Valkey. Separate buckets for `/purchases` POST and `/vote`.

### Schema & migrations
- Use **Drizzle** or **Prisma**. Migrations run on `web` startup (`migrate deploy`) and in CI.
- Enable `pg_trgm` for fuzzy title search and duplicate heuristics.

### Observability
- **Logs**: pino JSON with `request_id`; one line per request/job.
- **Metrics** (optional): Prometheus endpoint `/metrics` from `web` and `worker` with counters (requests, job durations, rejects due to PII).
- **Tracing** (optional): OpenTelemetry SDK exporting to Jaeger (`otel/jaeger` container) for job spans.

### Dev → Prod parity
- Keep env vars and names consistent; swap Localstack with S3 and managed Redis/DB in prod.
- JWT keys: generate RSA keypair per environment; publish JWKS from `web` (`/.well-known/jwks.json`).
- Configure CORS to allow only the front-end origin in prod; refresh token as httpOnly + SameSite=Strict cookie.

---

## 1. Data Model & Architecture

### 1.1 Core Entities

| Entity | Purpose | Key Fields |
| ------ | ------- | ---------- |
| **Game** | Master catalog entry for each retail SKU (seeded from IGDB or equivalent). | `id`, `platform_id`, `title`, `igdb_slug`, `release_year` |
| **GameListing** | Groups comparable condition tiers (Sealed, CIB, Loose, etc.). | `id`, `game_id`, `condition_enum`, `notes` |
| **GamePrice** | Snapshot of market price and confidence stats. | `id`, `game_listing_id`, `date_calculated`, `median_value_cents`, `iqr_cents`, `confidence_score` |
| **Console** | Master catalog of hardware SKUs. Flexible, allowing user-added entries later. | `id`, `title`, `vendor`, `sku`, `notes` |
| **ConsoleListing** | Similar to *GameListing*, for consoles. | same fields as GameListing |
| **ConsolePrice** | Similar to *GamePrice*. | same fields as GamePrice |
| **User** | Represents any logged-in participant. | `id`, `display_name`, `email`, `is_verified_store`, `reputation`, `created_at`, `cpf_hash` (encrypted + salted) |
| **Store** | Named seller (shop, YouTube channel, ML store). | `id`, `display_name`, `store_type_enum`, `verified_flag`, `external_refs(json)` |
| **Livestream** | Specific livestream event selling items. | `id`, `store_id`, `platform (YouTube/Twitch)`, `url`, `start_time` |
| **Purchase** | Concrete sale event. | `id`, `listing_type` (game/console), `listing_id`, `purchase_type_enum`, `price_cents`, `sold_at`, `submitted_by`, `evidence_url`, `evidence_thumb_url`, `source_enum`, `store_id`, `livestream_id`, `confidence_raw` |
| **Report** | Feedback by users on purchases. | `id`, `purchase_id`, `reporter_id`, `report_enum`, `created_at` |

---

### 1.2 Relationships Overview (ER text)

```
User ─┬──< Purchase >──┬─ GameListing >── Game
       │               └─ ConsoleListing >── Console
       └──< Report >── Purchase

Store ───< Purchase
       └──< Livestream ───< Purchase
```

A *Purchase* connects to either a *GameListing* or *ConsoleListing* (never both). Each listing aggregates many purchases and price snapshots. *Reports* attach to purchases; users can vote or report fraud.

---

### 1.3 Enumerations

```text
ConditionEnum      = { GRADED, SEALED, CIB, LOOSE, CIB_REPRO, LOOSE_REPRO, BOX_ONLY, MANUAL_ONLY }
SourceEnum         = { LIVE, WEB_MARKETPLACE, STORE_PHYSICAL, INDIVIDUAL }
ReportEnum         = { LIKE, DISLIKE, FRAUD }
StoreTypeEnum      = { PHYSICAL_SHOP, YOUTUBE_CHANNEL, SHOPEE_SHOP, MERCADOLIVRE_STORE, OTHER }
```

---

### 1.4 Confidence Algorithm

Each purchase contributes a weighted confidence score:

```
RawScore = BaseWeight(SourceEnum) * (1 + log10(UserReputation + 1))
Confidence = 100 * (1 - e^(-ΣRawScores / 25))
```

A nightly aggregation job recalculates prices for each listing and stores them in `GamePrice` or `ConsolePrice` tables, keeping historical snapshots for graph rendering.

---

## 2. LGPD & Privacy Implementation

### 2.1 CPF Handling
* CPF is stored **only as a hashed and salted string** (`SHA-256(CPF + random_salt)`).
* Used **only for identity uniqueness and anti-fraud logic**.
* Never displayed publicly or logged in client responses.
* No verification or lookup of CPF — it’s a psychological deterrent only.

### 2.2 Receipts and PII in Images

| Rule | Implementation |
|------|----------------|
| **No full receipts** | The MVP forbids uploading full receipts. Only photos showing *game + value* are accepted. |
| **Allowed proofs** | - Screenshot of live or marketplace.<br>- Photo of game with price visible.<br>- Photo of game + payment terminal showing value.<br>- Photo of game + phone showing PIX value (blur personal data). |
| **CNPJ & Store Names** | Not personal data — safe to show publicly. |
| **Names, CPFs, e-mails** | Detected and blurred automatically or rejected. |

### 2.3 Image Sanitization Pipeline

1. **Client-side validation**: UI warns users to blur or cover personal info before upload.
2. **Server-side pipeline**:
   * Convert to WebP, max width 480 px.
   * Remove EXIF metadata.
   * OCR via Tesseract → regex scan for CPF (`\d{3}\.\d{3}\.\d{3}-\d{2}`), phone, email.
   * If found → reject image and return error message.
3. **Storage**:
   * Save only sanitized WebP in S3 bucket with public CDN access.
   * Originals discarded immediately to avoid sensitive data retention.

This approach eliminates LGPD liabilities while keeping proofs usable.

---

## 3. Business Rules Summary

| Feature | Rule |
|----------|------|
| **Submissions** | One purchase per unique combination of (game, store, source, date, price). Duplicates are auto-detected via perceptual hash (pHash). |
| **Verification** | Stores can be verified manually (blue check). Verified store submissions get +50% base confidence. |
| **Likes / Reports** | Users may like, dislike, or report fraud once per purchase. Fraud flags from 3+ users drop purchase confidence to 0 until reviewed. |
| **Confidence Scaling** | Sources have base weights: `LIVE=1.0`, `INDIVIDUAL=1.2`, `STORE=1.5`, `MARKETPLACE=2.0`. Likes and user reputation apply multiplicative bonuses. |
| **Reputation** | Starts at 0. +3 for confirmed sale, -10 for fraud confirmed. |
| **Moderation** | Fully automated; transparency replaces human moderation. All votes and actions are public in the profile page. |

---

## 4. UI / Screens Detailed Specification

### 4.1 Home Screen
* **Search bar** (autocomplete Games & Consoles).
* **Top Movers**: Games with most recent confidence gain.
* **Most Verified Sales**: Items with high-confidence averages.
* **Call-to-Action**: “Submit a Sale” banner.

### 4.2 Game Screen (`/game/{slug}`)
* **Header**: Box art, title, platform, release year.
* **Tabs** by condition (Sealed, CIB, Loose, etc.). Each tab shows:
  * Latest `GamePrice` (median, date, confidence bar).
  * 30/90-day trend graph.
* **Filters**:
  * By source type (Live, Web, Store, Individual)
  * By confidence range (slider)
  * Sort by date or price
* **Infinite scroll list** of `Purchases`:
  * Thumbnail, date, price, confidence, submitter display name.
  * Title changes depending on source:  
    * “Livestream at [StoreName] – [Date]”  
    * “Mercado Livre listing – [Date]”
  * Clicking opens **Purchase Detail**.
* **Submit Button (floating)**: Opens Purchase Wizard pre-filled with Game info.

### 4.3 Console Screen (`/console/{slug}`)
* Identical to Game Screen but uses Console data.
* Allows community-added console listings (in future versions).

### 4.4 Purchase Detail (`/purchase/{id}`)
* **Header**: Game/Console title + condition.
* **Meta**: date, price, store, type, submitter.
* **Evidence Viewer**: Inline image or embedded live timestamp.
* **Reputation data**: mini-graph of likes/dislikes.
* **Action buttons**: Like / Dislike / Flag Fraud.
* **Duplicates**: If purchase merged with others, show linked entries.

### 4.5 Submit Sale Wizard
1. **Select Item** (search Game/Console).
2. **Select Condition** (CIB, Loose, etc.).
3. **Select Source Type** (Live, Web, Store, Individual).
4. **Enter Price and Date.**
5. **Attach Evidence:**  
   - Image upload or URL.  
   - Preview + automatic OCR check.  
   - Display rules: “Do not upload receipts with personal data.”
6. **Review & Confirm.**
   - Warning about fraud penalties.
   - Confirmation modal before final submit.

### 4.6 Profile Screen (`/u/{handle}`)
* **Avatar & badges:** Verified check, Reputation score.
* **Stats:** Number of submissions, likes received, confidence avg.
* **Tabs:**
  - *Sales submitted*: list of purchases.
  - *Likes given*: interactions by the user.
  - *Reputation log*: visible list of all actions for transparency.

### 4.7 Store Screen (`/store/{id}`)
* Banner with store name, verification status.
* List of all purchases tied to the store.
* Reputation of store based on purchase confidence average.

### 4.8 Livestream Screen (`/live/{id}`)
* Embedded YouTube/Twitch player.
* Table of Purchases from that stream with timestamps.
* Store name, date, and list of confirmed duplicates.

---

## 5. System Processes / Flows

### 5.1 Submission Flow
1. User logs in via Google.
2. Opens Submit Sale Wizard.
3. Fills in details → Uploads image/URL.
4. Backend sanitizes evidence image.
5. Creates Purchase entry → status `pending` → confidence calculated.
6. Appears immediately on Game page (with pending tag) while confidence updates nightly.

### 5.2 Reputation Flow
* +3 points per validated sale.
* +1 point per like received from verified users.
* -10 points for confirmed fraud.
* Level thresholds:
  * 0–49 → Observer (cannot mark duplicates)
  * 50–199 → Contributor
  * 200+ → Curator (can merge duplicates)

### 5.3 Fraud / Duplicate Detection Flow
* Perceptual hash (pHash) used for live screenshots or marketplace prints.
* Potential duplicates automatically grouped.
* Verified Curators can confirm merges manually.

### 5.4 Nightly Aggregation Flow
1. Gather all purchases by listing within 180 days.
2. Filter out low-confidence (<20) and fraud-flagged.
3. Compute median, IQR, confidence.
4. Write new `GamePrice` snapshot.

---

## 6. Privacy & Compliance Checklist

| Area | Requirement | Implementation |
|------|--------------|----------------|
| **Data Minimization** | Collect only necessary data. | No full receipts; blur/filter PII. |
| **Purpose Limitation** | Use data only for anti-fraud and price aggregation. | Explicit in privacy policy. |
| **Security** | Protect stored data. | HTTPS + encrypted storage for CPF hashes. |
| **User Control** | Allow deletion of data. | Profile settings for data deletion. |
| **Transparency** | Clear public log of actions. | Public profile & visible votes. |

---

## 7. Implementation Roadmap

| Sprint | Deliverables |
|--------|---------------|
| **1** | Database setup, user auth (Google), base entities. |
| **2** | Submission wizard + image sanitization pipeline. |
| **3** | Game and Console screens (listings, filters, price charts). |
| **4** | Like/Dislike/Fraud + Reputation logic. |
| **5** | Cron jobs for nightly aggregation and reputation update. |
| **6** | Store & Livestream pages, final UI polish, deploy. |

---

## 8. HTTP API Endpoints (MVP)

> **Conventions**: JSON everywhere; `snake_case` keys; pagination via `?page=1&page_size=50` (max 100). All times ISO-8601 UTC. Errors use `{ "error": { "code": "...", "message": "..." } }`.

### 8.1 Auth / Session
- `POST /auth/login/google` → starts OAuth flow (redirect URL in response if using SPA popup).
- `GET  /auth/callback/google` → exchanges code for tokens, issues **Access JWT** + **Refresh cookie**.
- `POST /auth/refresh` → rotates refresh token, returns new Access JWT.
- `POST /auth/logout` → revokes refresh token (server-side), clears cookie.

### 8.2 Users & Profiles
- `GET  /me` (auth) → current user profile, roles, reputation.
- `PATCH /me` (auth) → update `display_name`.
- `GET  /users/{id}` (public) → public profile (no email/cpf_hash).
- `POST /users/{id}/verify-store` (role: **admin**) → toggles store verification for a linked Store/User.

### 8.3 Catalog & Search
- `GET  /search?q=...` (public) → mixed results (games, consoles, stores).
- `GET  /games/{slug}` (public) → game detail + listing summary.
- `GET  /games/{slug}/purchases` (public) → paged purchases with filters: `condition`, `source`, `min_confidence`, `sort`.
- `GET  /consoles/{slug}` (public) → console detail + listing summary.
- `GET  /consoles/{slug}/purchases` (public) → same filters as games.
- `GET  /stores/{id}` (public) → store profile + recent purchases.
- `GET  /livestreams/{id}` (public) → livestream info + purchases.

### 8.4 Submissions & Evidence
- `POST /purchases` (role: **user+**) → create purchase (wizard submit). Validates evidence; returns purchase id.
- `GET  /purchases/{id}` (public) → purchase detail, confidence, evidence URLs.
- `DELETE /purchases/{id}` (owner | **admin**) → soft-delete submission.
- `POST /evidence/upload` (role: **user+**) → presigned URL; server runs sanitization after upload completes.

### 8.5 Voting / Reports / Duplicates
- `POST /purchases/{id}/vote` (role: **user+**) → body `{ "value": "like"|"dislike" }` (idempotent; upsert).
- `POST /purchases/{id}/report` (role: **user+**) → body `{ "type": "fraud", "reason": "..." }`.
- `POST /purchases/{id}/dedupe` (role: **curator+**) → body `{ "duplicate_of": <purchase_id> }`.

### 8.6 Prices & Stats
- `GET  /prices/games/{slug}` (public) → array of `GamePrice` snapshots (date, median, iqr, confidence).
- `GET  /prices/consoles/{slug}` (public) → array of `ConsolePrice` snapshots.
- `GET  /stats/top-movers` (public) → list for Home screen.

### 8.7 Admin (minimal)
- `GET  /admin/health` (admin) → DB + queue + storage checks.
- `GET  /admin/tokens` (admin) → active refresh tokens for user (support revocation / suspicious activity).

---

## 9. Authentication, Authorization & Roles

### 9.1 Token Strategy (JWT)
- **Access Token (JWT)**: short-lived (15 min), signed **RS256**, audience `api`, issuer `your.domain`. Sent via `Authorization: Bearer <jwt>`.
- **Refresh Token**: httpOnly, `SameSite=Strict` cookie, 30 days TTL with rotation on each refresh. Server stores a `token_id (jti)` allowlist to enable revocation.
- **Key Management**: rotate signing keys every 90 days; expose **JWKS** at `/.well-known/jwks.json`.
- **Claims**:
  - `sub` (user id)
  - `roles` (array)
  - `rep` (reputation integer)
  - `ver` (is_verified_store bool)
  - `iat`, `exp`, `jti`

### 9.2 Roles & Permissions

Roles are cumulative; higher roles include lower permissions.

| Role | Who | Capabilities |
|------|-----|--------------|
| **anonymous** | visitor | read-only endpoints; search; view prices & purchases. |
| **user** | any logged-in user | submit purchases; vote/report once per purchase; manage own submissions. |
| **verified_store** | logged-in + verified badge | submissions gain +50% base weight; store linking; appears as verified in UI. |
| **curator** | reputation ≥ 200 (auto-assigned) | can mark duplicates; limited moderation (hide low-confidence spam temporarily). |
| **admin** | operator | verify stores; revoke tokens; delete content; access health endpoints. |

**Permission checks** happen via middleware parsing Access JWT and consulting a server-side cache of `user_id → role set`. Avoid putting sensitive decisions solely in the client.

### 9.3 Rate Limiting & Abuse Control
- Global: 120 req/min per IP (burst 240).
- Authenticated: 60 writes/hour per user, 500 reads/hour.
- Votes: max 50/day; Reports (fraud): max 10/day.
- Evidence uploads: max 10/day, 1 MB each.

### 9.4 Session & Security Considerations
- Store Access JWT **in memory** (not localStorage). Use refresh cookie for silent renew.
- CSRF: refresh endpoint requires **Double Submit Cookie** (`X-CSRF-Token` header) or SameSite Strict only.
- CORS: allow only the production/front-end origin.
- Logging: never log PII or secrets; redact query strings that may contain URLs with tokens.

---

## 10. Filtering & Pagination (API UX)

- Standard params: `page`, `page_size`, `sort=price|date|-price|-date`.
- Filters for purchases endpoints:
  - `condition`: `SEALED|CIB|LOOSE|...`
  - `source`: `LIVE|WEB_MARKETPLACE|STORE_PHYSICAL|INDIVIDUAL`
  - `min_confidence`: integer 0..100
  - `store_id`, `livestream_id`
  - `date_from`, `date_to`

---

## 11. Error Codes (examples)

| code | http | meaning |
|------|------|---------|
| `bad_request` | 400 | Validation failed (missing fields, invalid enum). |
| `unauthorized` | 401 | Missing/invalid token. |
| `forbidden` | 403 | Role not allowed for action. |
| `not_found` | 404 | Resource doesn't exist. |
| `rate_limited` | 429 | Too many requests. |
| `conflict` | 409 | Duplicate submission detected. |
| `server_error` | 500 | Unexpected failure. |

---

**End of Implementation Guide v1.1**

---

## 12. Diagrams

### 12.1 Entity–Relationship (ER) Overview
```mermaid
erDiagram
    USER {
        uuid id PK
        text display_name
        int reputation
        bool is_verified_store
        timestamptz created_at
    }
    STORE {
        uuid id PK
        text display_name
        enum store_type
        bool verified_flag
        json external_refs
    }
    GAME {
        uuid id PK
        text title
        uuid platform_id
        text igdb_slug
        int release_year
    }
    GAMELISTING {
        uuid id PK
        uuid game_id FK
        enum condition
        text notes
    }
    GAMEPRICE {
        uuid id PK
        uuid game_listing_id FK
        date date_calculated
        int median_value_cents
        int iqr_cents
        int confidence_score
    }
    CONSOLE {
        uuid id PK
        text title
        text vendor
        text sku
        text notes
    }
    CONSOLELISTING {
        uuid id PK
        uuid console_id FK
        enum condition
        text notes
    }
    CONSOLEPRICE {
        uuid id PK
        uuid console_listing_id FK
        date date_calculated
        int median_value_cents
        int iqr_cents
        int confidence_score
    }
    LIVESTREAM {
        uuid id PK
        uuid store_id FK
        text platform
        text url
        timestamptz start_time
    }
    PURCHASE {
        uuid id PK
        enum listing_type  // game|console
        uuid listing_id    // FK to GameListing or ConsoleListing
        enum purchase_type // SEALED|CIB|...
        int price_cents
        timestamptz sold_at
        uuid submitted_by FK
        text evidence_url
        text evidence_thumb_url
        enum source        // LIVE|WEB_MARKETPLACE|STORE_PHYSICAL|INDIVIDUAL
        uuid store_id FK
        uuid livestream_id FK
        float confidence_raw
        text status        // pending|active|rejected
    }
    REPORT {
        uuid id PK
        uuid purchase_id FK
        uuid reporter_id FK
        enum report_enum   // LIKE|DISLIKE|FRAUD
        timestamptz created_at
    }

    USER ||--o{ PURCHASE : submits
    USER ||--o{ REPORT : makes
    STORE ||--o{ LIVESTREAM : hosts
    STORE ||--o{ PURCHASE : involved
    GAME ||--o{ GAMELISTING : has
    GAMELISTING ||--o{ PURCHASE : aggregates
    GAMELISTING ||--o{ GAMEPRICE : snapshots
    CONSOLE ||--o{ CONSOLELISTING : has
    CONSOLELISTING ||--o{ PURCHASE : aggregates
    CONSOLELISTING ||--o{ CONSOLEPRICE : snapshots
    LIVESTREAM ||--o{ PURCHASE : includes
    PURCHASE ||--o{ REPORT : receives
```

### 12.2 Evidence Upload & Sanitization Flow
```mermaid
sequenceDiagram
    autonumber
    participant Client as Client (Browser)
    participant Web as Web/API (Next.js)
    participant S3 as ObjectStore (Localstack/S3)
    participant Q as Queue (Valkey/BullMQ)
    participant Worker as Worker Jobs

    Client->>Web: POST /evidence/upload (request presigned URL)
    Web-->>Client: presigned PUT URL + temp object key
    Client->>S3: PUT evidence to incoming/
    Client->>Web: POST /purchases (game, price, source, temp key)
    Web->>Q: Enqueue sanitize_job(temp key, purchase_id)
    Worker->>S3: GET incoming/temp
    Worker->>Worker: Convert→WebP(480px), strip EXIF
    Worker->>Worker: OCR + regex(PFI) [CPF/phone/email]
    alt Contains PII
        Worker-->>Web: mark purchase rejected
        Worker->>S3: DELETE incoming/temp
    else Clean
        Worker->>Worker: Compute pHash; gen thumb
        Worker->>S3: MOVE to evidence/ + thumbs/
        Worker-->>Web: update purchase (thumb URL, status=active, confidence_raw)
    end
    Web-->>Client: Purchase visible (pending→active)
```

### 12.3 Auth & RBAC Request Flow
```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Web as Web/API
    participant Google as Google OAuth

    User->>Web: GET /auth/login/google
    Web-->>User: Redirect to Google (OAuth)
    User->>Google: Consent & callback
    Google-->>Web: Auth code
    Web->>Google: Exchange code (tokens)
    Google-->>Web: id_token + profile
    Web->>Web: Create/Update user; mint Access JWT; set Refresh cookie
    Web-->>User: 200 OK (session established)

    Note over User,Web: Subsequent requests
    User->>Web: API request (+ Authorization: Bearer <JWT>)
    Web->>Web: Verify JWT (RS256, JWKS)
    Web->>Web: RBAC check (roles from claims + cache)
    alt Not allowed
        Web-->>User: 403 Forbidden
    else Allowed
        Web-->>User: Response
    end
```

---

## 13. Phased Delivery Plan

> Goal: ship a lean, reliable MVP quickly, with hardening and guardrails baked in. Each phase is shippable; prefer small PRs and green pipelines.

### Phase 0 · Baseline Hardening
- **Repo hygiene**: `Makefile` (targets: `setup-local`, `build`, `run-docker`, `setup-db-docker`, `clean-local`, `lint`, `test`, `verify`), `.editorconfig`, `.nvmrc`, commit hooks (lint-staged).
- **Env scaffolding**: `.env.example` with all vars from *Architecture Overview*. Local-only secrets via `.env.local`; do **not** commit secrets.
- **CI**: run *lint + unit + typecheck* on PRs; cache pnpm; parallel jobs for web/worker.
- **Docs**: `CONTRIBUTING.md` with conventions (naming, enums, API style, error envelope), branch strategy, review checklist.

### Phase 1 · Data Layer
- **Drizzle ORM + PostgreSQL** with UUID PKs (`gen_random_uuid()`), enums, and extensions: `pg_trgm`, `unaccent`.
- **Migrations** define core schema: `users`, `stores`, `games`, `consoles`, `game_listings`, `console_listings`, `purchases`, `reports`, `game_prices`, `console_prices`, `livestreams`, `reputation_events`.
- **Seeders**: games/consoles, store catalog (known YouTube channels/shops), reputation defaults.
- **DB scripts** wired to Docker entrypoint**: `migrate deploy` + `seed` on first run; idempotent.
- **Tests**: unit tests for schema helpers, dedupe keys, and confidence math.
- **Baseline datasets** exported for local dev.

**Data Layer (Drizzle) specifics**
- Use `drizzle-kit` for migrations. Validate enums mirror `ConditionEnum`, `SourceEnum`, `ReportEnum`, etc.
- Add functional indexes for case-insensitive search (`unaccent(lower(title))`).

### Phase 2 · Auth & User Foundation
- **Google OAuth** in web app; issue **JWT (RS256)** + **refresh-cookie** rotation; publish **JWKS**.
- **RBAC middleware** with role checks (`anonymous`, `user`, `verified_store`, `curator`, `admin`).
- **Profiles & reputation** persisted; `/me`, `/users/{id}`, `/admin/health` endpoints.
- **Security**: Valkey-backed rate limiter; CSRF protection for refresh; CORS lock-down.
- **Tests**: Playwright/API smoke tests for login, token refresh, and guarded routes.
- **Dataset ingestion**: Build parsing scripts in `db` to ingest **PlayMyData CSVs** under `datasets/PlayMyData/`. Normalize platforms, titles, release data and seed **Game**, **Console**, and default listings. Add fixtures/tests and wire commands into the Makefile (`setup-db-docker`) & Docker workflow.

### Phase 3 · Submission & Evidence Pipeline
- Implement `/purchases`, `/evidence/upload`, `vote/report` with Zod DTOs (`@retroprice/shared`).
- **S3 presign + Localstack** buckets; **worker** consumes sanitization queue (Sharp, Tesseract, pHash).
- **Duplicate detection** rules: pHash clustering + (game, store, source, date, price) composite key.
- **Admin/manual promotions** supported alongside automatic thresholds.
- **Integration tests**: mock S3/Redis; assert job side-effects, status transitions, and rejection on PII.

### Phase 4 · Aggregation & Reputation Jobs
- Schedule **nightly BullMQ** jobs: price snapshots (median/IQR/confidence), reputation recalculation, orphan cleanup.
- Expose `/prices/*`, `/stats/top-movers`; add structured logs and optional Prom metrics.
- **Backfill scripts** for historical recomputation.
- **Discard original uploads after sanitization** (keep only WebP thumbs/evidence per LGPD).

### Phase 5 · Frontend Experience
- Build **layout + design tokens**; implement pages: Home, Game/Console detail (tabs, charts, filters), Purchase detail (evidence viewer, voting), Submit wizard (multi-step), Profile/Store/Livestream.
- Integrate **auth states**, client cache (SWR/React Query), and **optimistic updates** for votes.
- **E2E & a11y** checks (Playwright + axe-core).
- **Roles**: auto‑promote **curator** at **200 reputation**; allow **admin** manual promotion.

### Phase 6 · Polish & Ops
- Finalize **rate limits**, error responses, admin utilities (token revocation, user lock).
- **Prod readiness**: secrets management, DB backups, bucket lifecycle policies, alerts.
- **Observability**: structured logging baseline; optional tracing (OTel → Jaeger); dashboards for job durations and rejection rates.
- **Release**: deployment workflow (CI → image registry → your hosting), full regression run, tag `v1.0.0-mvp`.

---

