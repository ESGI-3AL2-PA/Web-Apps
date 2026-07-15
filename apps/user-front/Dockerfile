# Pinned to the Node 22 LTS line by digest (M5). Bump the tag+digest together.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/config/package*.json ./packages/config/
COPY packages/hooks/package*.json ./packages/hooks/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/user-front/package*.json ./apps/user-front/
RUN npm ci

# DEV
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/ ./packages/
COPY apps/user-front/ ./apps/user-front/
EXPOSE 5000
CMD ["npx", "vite", "--host", "--port", "5000", "--clearScreen", "false", "--config", "apps/user-front/vite.config.ts", "apps/user-front"]

# PROD build — compile the SPA to immutable static assets.
FROM deps AS build
ENV NODE_ENV=production
# VITE_* values are inlined into the bundle at build time (via @repo/config), so
# they must be present when `vite build` runs — pass them as build args. The prod
# compose supplies them; defaults keep a bare `docker build` working.
ARG VITE_AUTH_SERVICE_URL
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_ADMIN_URL
ENV VITE_AUTH_SERVICE_URL=$VITE_AUTH_SERVICE_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_ADMIN_URL=$VITE_ADMIN_URL
COPY packages/ ./packages/
COPY apps/user-front/ ./apps/user-front/
RUN npx turbo run build --filter=user-front

# PROD serve — hardened static host. nginx-unprivileged runs as the `nginx` user
# (uid 101, M4) and listens on 8080 (no root needed for a low port).
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS prod
COPY apps/user-front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/user-front/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
