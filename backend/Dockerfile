FROM node:22-bookworm-slim

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend ./backend
COPY frontend ./frontend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @smart-acr/backend prisma:generate
RUN pnpm --filter @smart-acr/backend build

EXPOSE 4000

CMD ["pnpm", "--filter", "@smart-acr/backend", "start"]
