# Dockerfile multi-étapes de la landing page (React + Vite servi en statique).
# Étapes : base -> deps -> (dev | build -> prod).

# Épinglé sur la ligne Node 22 LTS par digest (M5). Bumper tag + digest ensemble.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# Dépendances : ne copie que les manifestes du workspace pour maximiser le cache
# de couches, puis installe tout via npm ci.
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/config/package*.json ./packages/config/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/landing/package*.json ./apps/landing/
RUN npm ci

# DEV : serveur Vite avec hot reload sur le port 6060.
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/landing/ ./apps/landing/
RUN npm ci
EXPOSE 6060
CMD ["npx", "vite", "--host", "--port", "6060", "--clearScreen", "false", "--config", "apps/landing/vite.config.ts", "apps/landing"]

# PROD build — compile la landing page en assets statiques immuables.
FROM deps AS build
ENV NODE_ENV=production
# Les valeurs VITE_* sont inlinées dans le bundle au build (via @repo/config) :
# elles doivent donc être présentes quand `vite build` tourne — passées en build
# args. Le compose prod les fournit ; les défauts gardent un `docker build` nu
# fonctionnel.
ARG VITE_AUTH_SERVICE_URL
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_ADMIN_URL
ENV VITE_AUTH_SERVICE_URL=$VITE_AUTH_SERVICE_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_ADMIN_URL=$VITE_ADMIN_URL
COPY packages/ ./packages/
COPY apps/landing/ ./apps/landing/
RUN npx turbo run build --filter=landing

# PROD serve — hôte statique durci. nginx-unprivileged tourne sous l'utilisateur
# `nginx` (uid 101, M4) et écoute sur 8080 (pas de root requis pour un port haut).
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS prod
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/landing/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
