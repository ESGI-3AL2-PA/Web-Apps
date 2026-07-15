# Pinned to the Node 22 LTS line by digest (M5). Bump the tag+digest together.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# @repo/satan shells out to python3 with `ply` (parse SATAN QL) and `pymongo`
# (run it against Mongo). A self-contained venv sidesteps Alpine's PEP-668
# externally-managed guard.
RUN apk add --no-cache python3 \
  && python3 -m venv /opt/satan-venv \
  && /opt/satan-venv/bin/pip install --no-cache-dir "ply==3.11" "pymongo>=4.6,<5"
ENV SATAN_PYTHON=/opt/satan-venv/bin/python

# Dependencies
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/satan/package*.json ./packages/satan/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/api/package*.json ./apps/api/
RUN npm ci

# DEV
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/ ./packages/
COPY apps/api/src/ ./apps/api/src/
EXPOSE 3000
CMD ["npx", "tsx", "--watch", "apps/api/src/index.ts"]

# PROD
FROM deps AS prod
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npx turbo run build --filter=api
# Drop root: the node:*-alpine image ships an unprivileged `node` user (uid 1000).
# Build runs as root (writes to /app); the runtime only reads the compiled dist.
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
