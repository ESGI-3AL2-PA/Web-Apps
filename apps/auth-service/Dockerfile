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

# PROD
FROM deps AS prod
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/auth-service/ ./apps/auth-service/
RUN npx turbo run build --filter=auth-service
# Drop root: the node:*-alpine image ships an unprivileged `node` user (uid 1000).
# Build runs as root (writes to /app); the runtime only reads the compiled dist.
USER node
EXPOSE 3001
CMD ["node", "apps/auth-service/dist/index.js"]
