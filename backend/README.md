# Backend

The backend in [backend/](/D:/All%20AI%20Projects/smart-acr/backend) is the source of truth for workflow, authorization, archival state, audit logging, and operational data.

## Structure

```text
backend/
  prisma/
  src/
    @types/
    config/
    helpers/
    common/
    modules/
  .env.example
  .gitignore
  biome.json
  docker-compose.yml
  Dockerfile
  package.json
  README.md
  tsconfig.json
```

## Module layout

- `auth`
- `acr`
- `workflow`
- `dashboard`
- `employees`
- `organization`
- `templates`
- `archive`
- `notifications`
- `audit`
- `analytics`
- `settings`
- `files`
- `health`

## Local setup

1. Copy [`.env.example`](/D:/All%20AI%20Projects/smart-acr/backend/.env.example) to `.env`.
2. Start the backend infrastructure first:

```bash
docker compose up -d postgres redis minio
```

3. From the [backend/](/D:/All%20AI%20Projects/smart-acr/backend) folder, run:

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm seed
pnpm dev
```

If you prefer to start the backend from the repository root, use:

```bash
pnpm db:generate
pnpm db:push
pnpm seed
pnpm dev:backend
```

PostgreSQL is published on host port `5433` to avoid conflicts with an existing local PostgreSQL service on `5432`.

## Useful commands

```bash
pnpm --filter @smart-acr/backend prisma:generate
pnpm --filter @smart-acr/backend prisma:push
pnpm --filter @smart-acr/backend prisma:migrate
pnpm --filter @smart-acr/backend prisma:seed
pnpm --filter @smart-acr/backend test
pnpm --filter @smart-acr/backend build
```

## Backend-only Docker

Use [backend/docker-compose.yml](/D:/All%20AI%20Projects/smart-acr/backend/docker-compose.yml) when you want to run backend infrastructure and the API without bringing up the frontend.
