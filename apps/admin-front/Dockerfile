# Dockerfile multi-stage de l'admin-front : base -> deps -> (dev | build -> prod).
# Le stage `dev` sert Vite avec hot reload ; `build` compile la SPA et `prod` la sert via nginx.
#
# Epingle a la ligne Node 22 LTS par digest (M5). Bumper le tag + le digest ensemble.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# Dependances : ne copie que les manifests (package*.json) des workspaces necessaires pour
# maximiser le cache de couches Docker avant `npm ci`.
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/config/package*.json ./packages/config/
COPY packages/hooks/package*.json ./packages/hooks/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/admin-front/package*.json ./apps/admin-front/
RUN npm ci

# DEV : serveur de developpement Vite (hot reload), expose sur le port 4000.
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/admin-front/ ./apps/admin-front/
RUN npm ci
EXPOSE 4000
CMD ["npx", "vite", "--host", "--port", "4000", "--clearScreen", "false", "--config", "apps/admin-front/vite.config.ts", "apps/admin-front"]

# Build PROD : compile la SPA en assets statiques immuables.
FROM deps AS build
ENV NODE_ENV=production
# Les valeurs VITE_* sont figees dans le bundle au moment du build (via @repo/config), elles
# doivent donc etre presentes quand `vite build` s'execute — passees en build args. Le compose
# de prod les fournit ; les valeurs par defaut permettent a un simple `docker build` de marcher.
ARG VITE_AUTH_SERVICE_URL
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_ADMIN_URL
ENV VITE_AUTH_SERVICE_URL=$VITE_AUTH_SERVICE_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_ADMIN_URL=$VITE_ADMIN_URL
COPY packages/ ./packages/
COPY apps/admin-front/ ./apps/admin-front/
RUN npx turbo run build --filter=admin-front

# Service PROD : hote statique durci. nginx-unprivileged tourne sous l'utilisateur `nginx`
# (uid 101, M4) et ecoute sur 8080 (pas besoin de root pour un port non privilegie).
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS prod
COPY apps/admin-front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin-front/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
