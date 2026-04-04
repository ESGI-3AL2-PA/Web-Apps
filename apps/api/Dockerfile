FROM node:25-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY packages/ui/package*.json ./packages/ui/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY apps/api/package*.json ./apps/api/
RUN npm ci

# DEV
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/ ./packages/
COPY apps/api/src/ ./apps/api/src/
EXPOSE 3000
CMD ["npx", "tsx", "--watch", "apps/api/src/index.ts"]

# PROD
FROM deps AS prod
ENV NODE_ENV=production
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npx turbo run build --filter=api
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
