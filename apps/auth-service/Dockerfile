# Pinned to the Node 22 LTS line by digest (M5). Bump the tag+digest together.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/auth-service/package*.json ./apps/auth-service/
RUN npm ci

# DEV
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/ ./packages/
COPY apps/auth-service/src/ ./apps/auth-service/src/
EXPOSE 3001
CMD ["npx", "tsx", "--watch", "apps/auth-service/src/index.ts"]

# BUILD — compile TS → dist with the full toolchain (needs devDeps).
FROM deps AS build
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/auth-service/ ./apps/auth-service/
RUN npx turbo run build --filter=auth-service

# PROD — prod-only deps + compiled output. No toolchain (tsx/tsc/turbo/eslint) ships at
# runtime; the superadmin seed one-shot runs the compiled dist, not tsx on source.
FROM base AS prod
ENV NODE_ENV=production
# Only the workspaces on auth-service's PROD dependency path — omit the *-config workspaces so
# their build-only deps (typescript-eslint/eslint/tsc) aren't pulled in by npm ci --omit=dev.
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY apps/auth-service/package*.json ./apps/auth-service/
RUN npm ci --omit=dev
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/auth-service/dist ./apps/auth-service/dist
# Drop root: the node:*-alpine image ships an unprivileged `node` user (uid 1000).
USER node
EXPOSE 3001
CMD ["node", "apps/auth-service/dist/index.js"]
