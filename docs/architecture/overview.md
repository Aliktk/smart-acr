# Architecture Overview

## Intent

The project is now organized as two individually runnable applications:

- `backend/`
- `frontend/`

This preserves the approved FIA UI direction while making runtime ownership clear and keeping backend concerns isolated from frontend delivery.

## Top-level layout

```text
smart-acr/
  backend/
  frontend/
  docs/
  infra/
```

## Runtime responsibilities

- `frontend/` owns navigation, pages, API calls, shell layout, and form preview surfaces.
- `backend/` owns workflow logic, authorization, persistence, audit events, and archive state.
- `docs/forms/` remains the reference for form fidelity.

## Platform choices

- Frontend: Next.js 15 App Router, TypeScript, Tailwind v4, TanStack Query
- Backend: NestJS 11, Prisma, PostgreSQL
- Infra: Redis, MinIO seam, Docker Compose
- Auth: local username/password for development, backend-controlled cookies
- Workflow: explicit transition service with a future orchestration seam
