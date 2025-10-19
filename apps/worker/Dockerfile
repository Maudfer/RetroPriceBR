# syntax=docker/dockerfile:1.7-labs
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_PRODUCTION=false

FROM base AS deps
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm install --workspaces --include-workspace-root

FROM deps AS builder
ENV NODE_ENV=production
ENV NPM_CONFIG_PRODUCTION=false
COPY . .
RUN npm install --workspaces --include-workspace-root
RUN npm run build --workspace @retroprice/shared \
	&& npm run build --workspace @retroprice/core \
	&& npm run build --workspace @retroprice/db \
	&& npm run build:worker

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/worker/dist /app/apps/worker/dist
COPY --from=builder /app/apps/worker/package.json /app/apps/worker/package.json
COPY --from=builder /app/node_modules /app/node_modules
CMD ["npm", "run", "start:worker"]
