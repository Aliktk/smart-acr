FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

WORKDIR /workspace

# ── Stage: install all deps (dev + prod) ────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN pnpm install --frozen-lockfile

# ── Stage: compile ──────────────────────────────────────────────────────────
FROM deps AS build

COPY backend ./backend
COPY frontend ./frontend

RUN pnpm --filter @smart-acr/backend prisma:generate
RUN pnpm --filter @smart-acr/backend build

# ── Stage: production deploy (flat node_modules, no pnpm symlinks) ──────────
# pnpm deploy creates a self-contained directory with only prod deps resolved
# as real files — no symlink chains that break when copied between Docker stages.
FROM deps AS prod-deploy

COPY backend ./backend
COPY frontend ./frontend

RUN pnpm --filter @smart-acr/backend deploy --prod /deploy/backend

# Prisma generates its client into node_modules/.prisma at build time.
# pnpm deploy installs @prisma/client fresh but skips postinstall scripts,
# so copy the already-generated client from the build stage.
COPY --from=build /workspace/node_modules/.prisma /deploy/backend/node_modules/.prisma

# ── Stage: runtime image ────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV="production"

WORKDIR /workspace

RUN addgroup --system --gid 1001 smartacr \
  && adduser --system --uid 1001 --ingroup smartacr smartacr

# Production deps — flat directory, no symlinks (reliable across any platform)
COPY --from=prod-deploy /deploy/backend/node_modules ./backend/node_modules
COPY --from=prod-deploy /deploy/backend/package.json ./backend/package.json

# Compiled application and Prisma schema (for migrate / seed at runtime)
COPY --from=build /workspace/backend/dist ./backend/dist
COPY --from=build /workspace/backend/prisma ./backend/prisma

RUN mkdir -p /var/lib/smart-acr/storage \
  && chown -R smartacr:smartacr /var/lib/smart-acr /workspace

USER smartacr

WORKDIR /workspace/backend

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/ready').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1));"

CMD ["node", "dist/main.js"]
