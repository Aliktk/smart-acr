FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

WORKDIR /workspace

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY backend ./backend
COPY frontend ./frontend

RUN pnpm --filter @smart-acr/backend prisma:generate
RUN pnpm --filter @smart-acr/backend build

FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NODE_ENV="production"

RUN corepack enable

WORKDIR /workspace

RUN addgroup --system --gid 1001 smartacr \
  && adduser --system --uid 1001 --ingroup smartacr smartacr

COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /workspace/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /workspace/backend/package.json ./backend/package.json
COPY --from=build /workspace/frontend/package.json ./frontend/package.json
COPY --from=build /workspace/backend/dist ./backend/dist
COPY --from=build /workspace/backend/prisma ./backend/prisma
COPY --from=build /workspace/node_modules ./node_modules

RUN mkdir -p /var/lib/smart-acr/storage \
  && chown -R smartacr:smartacr /var/lib/smart-acr /workspace

USER smartacr

WORKDIR /workspace/backend

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "dist/main.js"]
