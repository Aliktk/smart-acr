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
# express is a peerDependency of @nestjs/platform-express — pnpm deploy skips
# peer deps. Add it as a direct dep here so the deploy stage picks it up.
RUN pnpm --filter @smart-acr/backend add express@^4.21.2
RUN pnpm --filter @smart-acr/backend prisma:generate
RUN pnpm --filter @smart-acr/backend build
# --legacy required for pnpm v10+ in non-injected workspaces.
# Produces a flat node_modules with real files (no symlinks) safe to copy.
RUN pnpm deploy --legacy --filter @smart-acr/backend --prod /workspace/deployed
# Overwrite @prisma/client with the generated version (has UserRole enums etc.)
RUN cp -r /workspace/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/. /workspace/deployed/node_modules/@prisma/client/ \
 && cp -r /workspace/node_modules/.pnpm/@prisma+client*/node_modules/.prisma /workspace/deployed/node_modules/.prisma

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV="production"
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN addgroup --system --gid 1001 smartacr \
  && adduser --system --uid 1001 --ingroup smartacr smartacr
COPY --from=build /workspace/deployed/node_modules ./node_modules
COPY --from=build /workspace/backend/dist ./dist
COPY --from=build /workspace/backend/prisma ./prisma
RUN mkdir -p /var/lib/smart-acr/storage \
  && chown -R smartacr:smartacr /var/lib/smart-acr /app
USER smartacr
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1));"
CMD ["node", "dist/main.js"]
