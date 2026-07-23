# Dockerfile multi-étapes du front utilisateur (SPA React/Vite).
# Étapes : base -> deps (install) -> dev | build -> prod (nginx).

# Épinglé sur la ligne Node 22 LTS par digest (M5). Faire évoluer tag + digest ensemble.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# Étape dépendances : copie uniquement les manifests puis `npm ci`, pour tirer
# parti du cache de couches tant que les package*.json ne changent pas.
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/config/package*.json ./packages/config/
COPY packages/hooks/package*.json ./packages/hooks/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/user-front/package*.json ./apps/user-front/
RUN npm ci

# Étape DEV : serveur Vite avec hot reload (le code source est monté en volume
# en dev, cf. note « dev dist bind-mount »).
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/user-front/ ./apps/user-front/
RUN npm ci
EXPOSE 5000
CMD ["npx", "vite", "--host", "--port", "5000", "--clearScreen", "false", "--config", "apps/user-front/vite.config.ts", "apps/user-front"]

# Étape BUILD (prod) : compile la SPA en assets statiques immuables.
FROM deps AS build
ENV NODE_ENV=production
# Les valeurs VITE_* sont inlinées dans le bundle au moment du build (via
# @repo/config) : elles doivent donc être présentes quand `vite build` s'exécute
# — on les passe en build args. Le compose de prod les fournit ; les valeurs par
# défaut permettent à un simple `docker build` de fonctionner.
ARG VITE_AUTH_SERVICE_URL
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_ADMIN_URL
ARG VITE_LANDING_URL
ENV VITE_AUTH_SERVICE_URL=$VITE_AUTH_SERVICE_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_ADMIN_URL=$VITE_ADMIN_URL \
    VITE_LANDING_URL=$VITE_LANDING_URL
COPY packages/ ./packages/
COPY apps/user-front/ ./apps/user-front/
RUN npx turbo run build --filter=user-front

# Étape PROD serve : hôte statique durci. nginx-unprivileged tourne sous
# l'utilisateur `nginx` (uid 101, M4) et écoute sur 8080 (pas de root requis
# pour un port non privilégié).
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS prod
COPY apps/user-front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/user-front/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
