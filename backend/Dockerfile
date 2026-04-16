FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable
WORKDIR /workspace

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend ./backend
COPY frontend ./frontend
# node-linker=hoisted gives a flat node_modules like npm/yarn.
# All packages including peer deps (express etc.) are hoisted to root.
# --no-frozen-lockfile tolerates any lockfile drift from local edits.
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --no-frozen-lockfile
# Prisma generate runs after install so the generated client lands in
# the flat node_modules/@prisma/client and node_modules/.prisma — no
# extra copy step needed.
RUN pnpm --filter @smart-acr/backend prisma:generate
RUN pnpm --filter @smart-acr/backend build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV="production"
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN addgroup --system --gid 1001 smartacr \
  && adduser --system --uid 1001 --ingroup smartacr smartacr
# Flat hoisted node_modules already includes express, @nestjs/*, @prisma/client,
# and the generated .prisma binaries — copy it all in one step.
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/backend/dist ./dist
COPY --from=build /workspace/backend/prisma ./prisma
RUN mkdir -p /var/lib/smart-acr/storage \
  && chown -R smartacr:smartacr /var/lib/smart-acr /app
USER smartacr
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1));"
CMD ["node", "dist/main.js"]
