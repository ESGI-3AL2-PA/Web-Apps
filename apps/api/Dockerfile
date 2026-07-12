FROM node:25-alpine AS base
WORKDIR /app

# @repo/satan shells out to python3 with the `ply` package to parse SATAN QL.
# A self-contained venv sidesteps Alpine's PEP-668 externally-managed guard and
# doesn't depend on the community `py3-ply` package being present.
RUN apk add --no-cache python3 \
  && python3 -m venv /opt/satan-venv \
  && /opt/satan-venv/bin/pip install --no-cache-dir ply==3.11
ENV SATAN_PYTHON=/opt/satan-venv/bin/python

# Dependencies
FROM base AS deps
COPY package*.json turbo.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/satan/package*.json ./packages/satan/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
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
