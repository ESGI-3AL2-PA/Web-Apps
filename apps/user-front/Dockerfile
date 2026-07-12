FROM node:25-alpine AS base
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

# PROD
FROM deps AS prod
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/user-front/ ./apps/user-front/
RUN npx turbo run build --filter=user-front
EXPOSE 5000
CMD ["npx", "vite", "preview", "--host", "--port", "5000", "--config", "apps/user-front/vite.config.ts", "apps/user-front"]
