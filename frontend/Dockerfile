FROM node:22-bookworm-slim

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend ./backend
COPY frontend ./frontend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @smart-acr/frontend build

EXPOSE 3000

CMD ["pnpm", "--filter", "@smart-acr/frontend", "start"]
