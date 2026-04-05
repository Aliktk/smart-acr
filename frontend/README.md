# Frontend

The frontend in [frontend/](/D:/All%20AI%20Projects/smart-acr/frontend) is the FIA Smart ACR / PER portal built with Next.js App Router.

## Structure

```text
frontend/
  public/
  src/
    @types/
    api/
    app/
    components/
    hooks/
    providers/
    templates/
    themes/
    validators/
  .env.example
  .gitignore
  biome.json
  Dockerfile
  package.json
  README.md
  tsconfig.json
```

## Responsibilities

- login and protected portal shell
- dashboard and queue views
- ACR creation and detail screens
- archive, search, notifications, analytics, and settings pages
- printable FIA form previews

## Local setup

1. Copy [`.env.example`](/D:/All%20AI%20Projects/smart-acr/frontend/.env.example) to `.env.local`.
2. From the [frontend/](/D:/All%20AI%20Projects/smart-acr/frontend) folder, run:

```bash
pnpm install
pnpm dev
```

If you prefer to start the frontend from the repository root, use:

```bash
pnpm dev:frontend
```

## Notes

- The frontend now contains its extracted theme, reusable UI components, and form components directly inside `src/`.
- It no longer relies on the old `figma-make-files` folder for runtime code.
- The API layer lives in `src/api/client.ts`.
