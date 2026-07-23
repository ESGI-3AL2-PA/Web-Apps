# Image multi-stage de l'api (Express + ts-rest). Stages : base -> deps -> dev / build -> prod.

# Épinglé sur la ligne Node 22 LTS par digest (M5). Bumper tag + digest ensemble.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# @repo/satan délègue à python3 via `ply` (parse le QL SATAN) et `pymongo`
# (l'exécute contre Mongo). Un venv autonome contourne le garde-fou PEP-668
# "externally-managed" d'Alpine.
RUN apk add --no-cache python3 \
  && python3 -m venv /opt/satan-venv \
  && /opt/satan-venv/bin/pip install --no-cache-dir "ply==3.11" "pymongo>=4.6,<5"
ENV SATAN_PYTHON=/opt/satan-venv/bin/python

# Dépendances : ne copie que les manifests puis npm ci, pour maximiser le cache de couches.
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/satan/package*.json ./packages/satan/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/api/package*.json ./apps/api/
RUN npm ci

# DEV — sources montées + tsx en watch pour le hot reload (voir le bind-mount du dist en dev).
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/api/src/ ./apps/api/src/
COPY seed-data/ ./seed-data/
RUN npm ci
EXPOSE 3000
CMD ["npx", "tsx", "--watch", "apps/api/src/index.ts"]

# BUILD — compile TS → dist avec toute la toolchain (a besoin des devDeps).
FROM deps AS build
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
# Les scénarios de seed vivent désormais à la racine du repo, donc hors de apps/api/ —
# on les copie explicitement pour que le stage prod puisse les tirer de la couche de build.
COPY seed-data/ ./seed-data/
RUN npx turbo run build --filter=api

# PROD — deps prod uniquement + sortie compilée. Aucune toolchain (tsx/tsc/turbo/eslint)
# à l'exécution ; les one-shots seed/migrate lancent le dist/scripts compilé, pas tsx sur la source.
FROM base AS prod
ENV NODE_ENV=production
# Seulement les workspaces du chemin de dépendances PROD de l'api — on omet les workspaces
# *-config pour que leurs deps build-only (typescript-eslint/eslint/tsc) ne soient pas
# tirées par npm ci --omit=dev.
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/satan/package*.json ./packages/satan/
COPY apps/api/package*.json ./apps/api/
RUN npm ci --omit=dev
# Sortie compilée des workspaces + de l'app (@repo/satan embarque aussi son worker python).
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/satan/dist ./packages/satan/dist
COPY --from=build /app/packages/satan/python ./packages/satan/python
COPY --from=build /app/apps/api/dist ./apps/api/dist
# Les scénarios de seed sont des données, pas du code : à la racine du repo pour que tsc
# ne les voie jamais, ce qui impose de les copier explicitement, sinon le one-shot seed n'a
# rien à lire. Le script les résout en ../../../../seed-data relativement à dist/scripts.
COPY --from=build /app/seed-data ./seed-data
# On abandonne root : l'image node:*-alpine fournit un utilisateur non privilégié `node` (uid 1000).
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
