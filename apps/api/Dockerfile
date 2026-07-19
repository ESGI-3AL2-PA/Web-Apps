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
COPY packages/shared/package*.json ./packages/shared/
COPY packages/satan/package*.json ./packages/satan/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/api/package*.json ./apps/api/
RUN npm ci

# DEV
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/api/src/ ./apps/api/src/
COPY seed-data/ ./seed-data/
RUN npm ci
EXPOSE 3000
CMD ["npx", "tsx", "--watch", "apps/api/src/index.ts"]

# BUILD — compile TS → dist with the full toolchain (needs devDeps).
FROM deps AS build
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
# Seed scenarios now live at the repo root, so they aren't under apps/api/ — copy
# them explicitly so the prod stage can pull them from the build layer.
COPY seed-data/ ./seed-data/
RUN npx turbo run build --filter=api

# PROD — prod-only deps + compiled output. No toolchain (tsx/tsc/turbo/eslint) ships at
# runtime; the seed/migrate one-shots run the compiled dist/scripts, not tsx on source.
FROM base AS prod
ENV NODE_ENV=production
# Only the workspaces on api's PROD dependency path — omit the *-config workspaces so their
# build-only deps (typescript-eslint/eslint/tsc) aren't pulled in by npm ci --omit=dev.
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/satan/package*.json ./packages/satan/
COPY apps/api/package*.json ./apps/api/
RUN npm ci --omit=dev
# Compiled workspace + app output (@repo/satan also ships its python worker).
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/satan/dist ./packages/satan/dist
COPY --from=build /app/packages/satan/python ./packages/satan/python
COPY --from=build /app/apps/api/dist ./apps/api/dist
# Seed scenarios are data, not source: they live at the repo root so tsc never sees
# them, which means they need copying explicitly or the seed one-shot has nothing to
# read. The seed script resolves them at ../../../../seed-data relative to dist/scripts.
COPY --from=build /app/seed-data ./seed-data
# Drop root: the node:*-alpine image ships an unprivileged `node` user (uid 1000).
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
