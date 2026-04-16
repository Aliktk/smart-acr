FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NEXT_TELEMETRY_DISABLED="1"

RUN corepack enable

WORKDIR /workspace

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json

RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --no-frozen-lockfile

FROM deps AS build

ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY frontend ./frontend
COPY backend ./backend

RUN pnpm --filter @smart-acr/frontend build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

RUN addgroup --system --gid 1001 smartacr \
  && adduser --system --uid 1001 --ingroup smartacr smartacr

# pnpm monorepo: Next.js detects workspace root (has package.json) as outputFileTracingRoot,
# so standalone output is: standalone/frontend/server.js + standalone/frontend/.next/
# node_modules land at standalone root (one level up from server.js) — Node resolution finds them.
COPY --from=build /workspace/frontend/.next/standalone ./
COPY --from=build /workspace/frontend/public ./frontend/public
COPY --from=build /workspace/frontend/.next/static ./frontend/.next/static

RUN chown -R smartacr:smartacr /app

USER smartacr

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

WORKDIR /app/frontend
CMD ["node", "server.js"]
