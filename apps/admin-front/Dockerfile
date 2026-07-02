FROM node:25-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/config/package*.json ./packages/config/
COPY packages/hooks/package*.json ./packages/hooks/
COPY packages/ui/package*.json ./packages/ui/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/admin-front/package*.json ./apps/admin-front/
RUN npm ci

# DEV
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/ ./packages/
COPY apps/admin-front/ ./apps/admin-front/
EXPOSE 4000
CMD ["npx", "vite", "--host", "--port", "4000", "--clearScreen", "false", "--config", "apps/admin-front/vite.config.ts", "apps/admin-front"]

# BUILD (prod bundle — VITE_* are inlined at build time)
FROM deps AS build
ENV NODE_ENV=production
ARG VITE_AUTH_SERVICE_URL
COPY packages/ ./packages/
COPY apps/admin-front/ ./apps/admin-front/
RUN npx turbo run build --filter=admin-front

# PROD (static assets served by nginx with SPA fallback)
FROM nginx:alpine AS prod
COPY apps/admin-front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin-front/dist /usr/share/nginx/html
EXPOSE 4000
CMD ["nginx", "-g", "daemon off;"]
