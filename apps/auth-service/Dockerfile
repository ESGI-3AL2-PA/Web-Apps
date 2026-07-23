# Épinglé sur la ligne Node 22 LTS par digest (M5). Bumper le tag ET le digest ensemble.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# Étape deps : copie les seuls package*.json des workspaces utiles et fait `npm ci`.
# On copie d'abord les manifestes (sans le code) pour maximiser le cache Docker.
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/auth-service/package*.json ./apps/auth-service/
RUN npm ci

# Étape DEV : exécute directement les sources TS via tsx en watch (hot reload).
# En dev, le dist est monté depuis l'hôte (bind mount), pas construit ici.
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/auth-service/src/ ./apps/auth-service/src/
RUN npm ci
EXPOSE 3001
CMD ["npx", "tsx", "--watch", "apps/auth-service/src/index.ts"]

# Étape BUILD — compile TS → dist avec toute la toolchain (a besoin des devDeps).
FROM deps AS build
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/auth-service/ ./apps/auth-service/
RUN npx turbo run build --filter=auth-service

# Étape PROD — dépendances de prod uniquement + sortie compilée. Aucune toolchain
# (tsx/tsc/turbo/eslint) au runtime ; le seed one-shot du superAdmin exécute le dist
# compilé, pas tsx sur les sources.
FROM base AS prod
ENV NODE_ENV=production
# On ne copie que les workspaces du chemin de dépendances PROD de auth-service — on omet
# les workspaces *-config pour que leurs deps de build (typescript-eslint/eslint/tsc) ne
# soient pas tirées par `npm ci --omit=dev`.
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/shared/package*.json ./packages/shared/
COPY apps/auth-service/package*.json ./apps/auth-service/
RUN npm ci --omit=dev
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/auth-service/dist ./apps/auth-service/dist
# On abandonne root : l'image node:*-alpine fournit un utilisateur non privilégié `node` (uid 1000).
USER node
EXPOSE 3001
CMD ["node", "apps/auth-service/dist/index.js"]
