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

# PROD
FROM deps AS prod
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/admin-front/ ./apps/admin-front/
RUN npx turbo run build --filter=admin-front
EXPOSE 4000
CMD ["npx", "vite", "preview", "--host", "--port", "4000", "--config", "apps/admin-front/vite.config.ts", "apps/admin-front"]
