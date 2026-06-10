FROM node:25-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/auth-service/package*.json ./apps/auth-service/
RUN npm ci

# DEV
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/ ./packages/
COPY apps/auth-service/src/ ./apps/auth-service/src/
EXPOSE 3001
CMD ["npx", "tsx", "--watch", "apps/auth-service/src/index.ts"]

# PROD
FROM deps AS prod
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/auth-service/ ./apps/auth-service/
RUN npx turbo run build --filter=auth-service
EXPOSE 3001
CMD ["node", "apps/auth-service/dist/index.js"]
