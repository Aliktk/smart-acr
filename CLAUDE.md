# Smart ACR — CLAUDE.md

## Project Overview

**Smart ACR** is a role-gated, state-driven workflow platform for digital Annual Confidential Reports (ACR/PER) in the FIA (Federal Investigation Agency). It routes evaluation forms through multi-stage approval chains with full audit logging, archive snapshots, and 6 custom form families.

**Monorepo** — PNPM workspaces: `@smart-acr/backend` (NestJS) + `@smart-acr/frontend` (Next.js)

---

## Commands

### Development

```bash
pnpm dev              # Run frontend (port 3000) + backend (port 4000) concurrently
pnpm dev:frontend     # Frontend only — Next.js on port 3000
pnpm dev:backend      # Backend only — NestJS watch mode on port 4000
```

### Build & Type Check

```bash
pnpm build            # Build all packages
pnpm typecheck        # TypeScript check across all packages
pnpm lint             # Lint all packages
```

### Database

```bash
pnpm db:migrate       # Run Prisma migrations (dev)
pnpm db:generate      # Regenerate Prisma client after schema changes
pnpm db:push          # Push schema without migration (dev only)
pnpm seed             # Seed database with default roles, users, org structure
```

### Testing

```bash
pnpm test             # Unit + integration tests (Jest, all packages)
pnpm e2e              # Playwright E2E tests
pnpm e2e:ui           # Playwright with interactive UI
```

### Docker / Deployment

```bash
pnpm docker:up        # Start full stack via Docker Compose
pnpm docker:down      # Stop and remove containers + volumes
pnpm deploy:onprem    # On-premises deployment script
```

---

## Architecture

```
smart-acr/
├── backend/          # NestJS API — port 4000
│   ├── prisma/       # Schema, migrations, seed
│   └── src/
│       ├── modules/  # Feature modules (acr, auth, employees, workflow, …)
│       ├── common/   # Prisma service, shared guards
│       ├── helpers/  # view-mappers.ts, security.utils.ts
│       └── config/   # env.ts (Zod-validated env)
├── frontend/         # Next.js 15 — port 3000
│   └── src/
│       ├── app/
│       │   ├── (auth)/     # Login, reset-password
│       │   └── (portal)/   # Protected routes (dashboard, acr, queue, …)
│       ├── components/     # UI, forms, dashboard, settings
│       ├── api/            # API client (client.ts)
│       └── @types/         # contracts.ts — shared API types
├── infra/            # Docker Compose, deploy scripts
├── e2e/              # Playwright tests
└── ACR forms/        # Reference PDFs for 6 form families
```

### Backend Modules

| Module | Purpose |
|--------|---------|
| `auth` | JWT login, refresh, session idle/max lifetime enforcement |
| `acr` | ACR state machine, transitions, form data |
| `workflow` | Routing logic, deadline calculation |
| `employees` | Staff records, service numbers, designations |
| `users` | User provisioning, role assignment |
| `organization` | Org hierarchy (Wing → Directorate → Region → Zone → Circle → Station) |
| `authority-matrix` | RBAC: role + org-scope → permissions |
| `archive` | Immutable ACR snapshots with hash verification |
| `audit` | Immutable audit trail (actor, role, IP, timestamp) |
| `files` | Signature/stamp/document uploads (MIME validated) |
| `analytics` | Dashboard metrics, completion rates |
| `dashboard` | Role-specific queues, overdue tracking |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, TypeScript, Prisma 6, PostgreSQL |
| Frontend | Next.js 15, React 19, TailwindCSS 4, TanStack Query |
| Auth | JWT (access 15m + refresh), bcryptjs, cookie-based sessions |
| Validation | Zod (env + frontend), class-validator (backend DTOs) |
| PDF Export | html2canvas + jsPDF (client-side) |
| Testing | Jest (unit/integration), Playwright (E2E) |
| Deployment | Docker Compose, on-premises bash scripts |

---

## ACR Workflow States

The ACR state machine (`AcrWorkflowState` enum) flows:

```
DRAFT
  → PENDING_ADMIN_FORWARDING    (Clerk forwards to RO)
  → PENDING_REPORTING           (Reporting Officer fills form)
  → PENDING_COUNTERSIGNING      (CSO reviews)
  → PENDING_SECRET_BRANCH_REVIEW (AD assigns DA, DA marks complete)
  → ARCHIVED                    (finalized, hash-verified snapshot)
```

Special branches: **Secret Branch** uses AD-first flow — AD reviews + assigns DA, DA marks complete.

---

## Role System (RBAC)

Key roles: `SUPER_ADMIN`, `IT_OPS`, `CLERK`, `REPORTING_OFFICER` (RO), `COUNTERSIGNING_OFFICER` (CSO), `ADDITIONAL_DIRECTOR` (AD), `DEPUTY_DIRECTOR` (DA), `SECRET_BRANCH`.

- Roles are scoped to org units via `RoleAssignment` (not global)
- Authority matrix: `role + org-scope → allowed actions`
- Signature/stamp rendering: only RO, CSO, AD see their assets on form

---

## Form Families (6 Templates)

| Code | For |
|------|-----|
| `ASSISTANT_UDC_LDC` | Assistants, UDC, LDC |
| `APS_STENOTYPIST` | APS, Stenotypist |
| `INSPECTOR_SI_ASI` | Inspectors, Sub-Inspectors, ASI |
| `SUPERINTENDENT_AINCHARGE` | Superintendents, AI |
| `CAR_DRIVERS_DESPATCH_RIDERS` | Drivers, Despatch Riders |
| `PER_17_18_OFFICERS` | Grade 17–18 Officers |

---

## Environment Setup

1. Copy `.env.example` → `backend/.env` and fill secrets:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/smart_acr?schema=public
JWT_ACCESS_SECRET=<64-char random string>
JWT_REFRESH_SECRET=<64-char random string>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=1
SESSION_IDLE_TIMEOUT_MINUTES=60
SESSION_MAX_LIFETIME_HOURS=10
WEB_ORIGIN=http://localhost:3000
PORT=4000
STORAGE_PATH=storage
FORGOT_PASSWORD_ENABLED=false
```

2. Start PostgreSQL on port **5433** (non-standard — not 5432)
3. Run migrations: `pnpm db:migrate`
4. Seed: `pnpm seed`

---

## Key Gotchas

- **DB port is 5433**, not the default 5432 — Docker Compose maps it this way
- **After any `prisma/schema.prisma` change**: run `pnpm db:migrate` then `pnpm db:generate`
- **Seed is destructive**: re-running `pnpm seed` clears and re-creates default data
- **Frontend typecheck** requires `.next/types` to exist — run `pnpm dev:frontend` once first, or use the typecheck script which handles it
- **File uploads** are stored locally at `backend/storage/` (not S3); path set via `STORAGE_PATH` env
- **Session idle timeout**: backend enforces 60-min idle + 10-hour max lifetime; frontend auto-redirects on 401
- **Migrations are named**: use descriptive names like `20260412_feature_name` (not auto-generated timestamps alone)
- **`view-mappers.ts`** is the single source of truth for shaping DB → API response — always update it when adding fields to schema
- **`contracts.ts`** (`frontend/src/@types/contracts.ts`) must stay in sync with backend DTOs manually

---

## API

- Backend base URL: `http://localhost:4000/api/v1`
- Auth: JWT in `Authorization: Bearer` header + httpOnly refresh cookie
- All responses follow envelope: `{ data, meta?, error? }`

---

## Testing Notes

- Backend tests: `jest --runInBand` (sequential — shares DB)
- E2E: Playwright config at `playwright.config.ts` (root)
- Form validation specs: `backend/src/modules/acr/acr-form-validation.spec.ts`
