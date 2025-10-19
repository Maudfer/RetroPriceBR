# syntax=docker/dockerfile:1.7-labs
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm install --include=dev

FROM deps AS builder
COPY . .
RUN npm run build --workspace @retroprice/shared \
	&& npm run build --workspace @retroprice/core \
	&& npm run build --workspace @retroprice/db

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/packages/db/dist /app/packages/db/dist
COPY --from=builder /app/packages/db/migrations /app/packages/db/migrations
COPY --from=builder /app/node_modules /app/node_modules
CMD ["node", "packages/db/dist/scripts/setup.js"]
