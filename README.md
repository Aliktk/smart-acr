# FIA Smart ACR / PER Management System

Production-oriented internal workflow platform for the Federal Investigation Agency (FIA), Pakistan, to digitize ACR / PER processing for BPS 1-16 employees.

This repository contains the full stack application used to:
- initiate and process ACRs through role-based workflow
- preserve form data across workflow stages
- manage employee master data and template selection
- archive finalized records
- generate audit trails and notifications
- provision real internal users through admin-managed onboarding

This is an internal controlled system. It is not a public signup product.

## Table of Contents
- [System Overview](#system-overview)
- [Business Scope](#business-scope)
- [Core Roles](#core-roles)
- [Workflow Model](#workflow-model)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Application Modules](#application-modules)
- [Data Model](#data-model)
- [Security Model](#security-model)
- [Admin and User Management](#admin-and-user-management)
- [Authentication and Password Lifecycle](#authentication-and-password-lifecycle)
- [Notifications, Audit, and Archive](#notifications-audit-and-archive)
- [PDF and Document Handling](#pdf-and-document-handling)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Seeded Accounts for Development](#seeded-accounts-for-development)
- [Testing and Validation](#testing-and-validation)
- [Production Readiness Review](#production-readiness-review)
- [Known Constraints and Follow-Up](#known-constraints-and-follow-up)
- [Additional Documentation](#additional-documentation)

## System Overview

The FIA Smart ACR / PER Management System digitizes the annual confidential reporting process for FIA staff. Instead of passing paper forms manually between clerical, reporting, countersigning, and archival stakeholders, the system preserves the official form layout digitally and applies controlled editing rights as the ACR moves through workflow.

The platform currently includes:
- Next.js frontend portal
- NestJS backend API
- Prisma + PostgreSQL data layer
- role-based workflow and visibility rules
- official FIA form variants
- admin-managed internal user provisioning
- archive snapshots and audit logs
- notifications and dashboard views

## Business Scope

The application supports:
- Clerk initiation of ACR packets
- Reporting Officer review and assessment
- Countersigning Officer review where applicable
- Secret Branch receipt, archival, and retrieval
- DG / executive read-only oversight
- Super Admin / IT operations management

Supported official form families:
- `ASSISTANT_UDC_LDC`
- `APS_STENOTYPIST`
- `INSPECTOR_SI_ASI`
- `SUPERINTENDENT_AINCHARGE`

## Core Roles

Primary supported roles:
- `SUPER_ADMIN`
- `IT_OPS`
- `CLERK`
- `REPORTING_OFFICER`
- `COUNTERSIGNING_OFFICER`
- `SECRET_BRANCH`
- `DG`
- `EXECUTIVE_VIEWER`
- `WING_OVERSIGHT`
- `ZONAL_OVERSIGHT`
- `EMPLOYEE`

Business intent by role:
- Clerk: initiate and maintain the clerk-owned portion of the ACR
- Reporting Officer: fill assessment sections and either return or forward
- Countersigning Officer: countersign where required and submit to Secret Branch
- Secret Branch: receive, archive, retrieve, and inspect final records
- DG / executive roles: read-only oversight and search/archive access
- Super Admin / IT Ops: manage users, organization settings, configuration, and platform operations

## Workflow Model

### Standard workflow

`Clerk -> Reporting Officer -> Countersigning Officer -> Secret Branch -> Archive`

### Non-countersigning workflow

`Clerk -> Reporting Officer -> Secret Branch -> Archive`

### Workflow states

- `DRAFT`
- `PENDING_REPORTING`
- `PENDING_COUNTERSIGNING`
- `SUBMITTED_TO_SECRET_BRANCH`
- `ARCHIVED`
- `RETURNED`

`Overdue` and `priority` are operational indicators derived from record state and due dates.

### Workflow sequence

```mermaid
flowchart LR
    A[Clerk Initiates ACR] --> B[Reporting Officer Review]
    B -->|Return| A
    B -->|Forward| C[Countersigning Officer]
    B -->|No countersigning required| D[Secret Branch]
    C -->|Return| A
    C -->|Submit| D
    D --> E[Archive Snapshot / Final Record]
```

### Returned flow

Returned records are not dead-end records. If an ACR is returned:
- Clerk can reopen it
- Clerk can edit clerk-owned fields again
- Clerk can resubmit it
- return remarks remain visible
- timeline and audit history preserve the return and correction chain

## System Architecture

### High-level context

```mermaid
flowchart LR
    User[FIA Internal User] --> Frontend[Next.js Portal]
    Frontend --> API[NestJS API]
    API --> DB[(PostgreSQL via Prisma)]
    API --> Storage[File Storage]
    API --> Audit[Audit Logs]
    API --> Notify[Notifications]
    API --> Archive[Archive Snapshots]
```

### Request architecture

```mermaid
flowchart LR
    Browser --> Routes[App Router Pages]
    Routes --> Client[API Client Layer]
    Client --> Backend[REST API]
    Backend --> Guards[Auth and Role Guards]
    Guards --> Services[Business Services]
    Services --> Prisma[Prisma Service]
    Prisma --> Postgres[PostgreSQL]
    Services --> AuditTrail[Audit Logging]
    Services --> Timeline[Workflow Timeline]
    Services --> Notifications[Notification Routing]
```

### Production deployment view

```mermaid
flowchart TB
    subgraph Client
      A[Browser]
    end

    subgraph App
      B[Frontend Next.js]
      C[Backend NestJS]
    end

    subgraph Data
      D[(PostgreSQL)]
      E[Object/File Storage]
    end

    subgraph Ops
      F[Audit Logs]
      G[Archive Snapshots]
    end

    A --> B
    B --> C
    C --> D
    C --> E
    C --> F
    C --> G
```

## Repository Structure

```text
smart-acr/
  backend/
    prisma/
    src/
      @types/
      common/
      config/
      helpers/
      modules/
  frontend/
    public/
    src/
      @types/
      api/
      app/
      components/
      templates/
      utils/
  docs/
    architecture/
    forms/
    testing/
  infra/
    docker/
  scripts/
  package.json
  pnpm-workspace.yaml
  README.md
```

## Application Modules

### Backend modules

Backend lives in [backend](backend/). Major modules:
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
- `users`
- `files`
- `health`

### Frontend areas

Frontend lives in [frontend](frontend/). Major pages and portal areas:
- login
- role verification / sign-in challenge
- dashboard
- queue
- search
- archive
- notifications
- audit logs
- analytics
- organization
- settings
- user management
- ACR initiation
- ACR detail / workflow review
- printable ACR view

## Data Model

The Prisma schema in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) models:

- `Wing`
- `Zone`
- `Office`
- `User`
- `UserRoleAssignment`
- `Session`
- `AuthChallenge`
- `Employee`
- `TemplateVersion`
- `AcrRecord`
- `AcrTimelineEntry`
- `Notification`
- `AuditLog`
- `PasswordResetToken`
- `FileAsset`
- `ArchiveSnapshot`
- `AdminSetting`

### Key domain relationships

```mermaid
erDiagram
    User ||--o{ UserRoleAssignment : has
    Wing ||--o{ Zone : contains
    Zone ||--o{ Office : contains
    User ||--o{ Session : owns
    User ||--o{ AcrRecord : initiates
    User ||--o{ AcrRecord : reports_on
    User ||--o{ AcrRecord : countersigns
    Employee ||--o{ AcrRecord : receives
    TemplateVersion ||--o{ AcrRecord : renders
    AcrRecord ||--o{ AcrTimelineEntry : has
    AcrRecord ||--o{ Notification : triggers
    AcrRecord ||--o{ AuditLog : generates
    AcrRecord ||--|| ArchiveSnapshot : archives
```

### User-management fields now supported

The `User` model includes the lifecycle and provisioning fields required for controlled internal onboarding:
- `id`
- `displayName`
- `username`
- `email`
- `badgeNo`
- `passwordHash`
- `departmentName`
- `wingId`
- `zoneId`
- `officeId`
- `mustChangePassword`
- `lastLoginAt`
- `isActive`
- `createdById`
- `updatedById`
- `createdAt`
- `updatedAt`

## Security Model

This is a deny-by-default internal platform.

Implemented security principles:
- no public privileged self-signup
- server-side role enforcement
- session cookies for authenticated requests
- record visibility based on active responsibility plus historical legitimacy
- read-only restrictions for oversight roles
- audit logging for sensitive operations
- forced password update option for newly provisioned users
- reset-token flow structure for future production delivery integration

### Access control model

- `SUPER_ADMIN` and `IT_OPS` manage users
- Clerk cannot manage users
- Reporting and Countersigning Officers cannot manage users
- DG remains read-only
- Secret Branch handles archival operations but is not a default user-admin role

## Admin and User Management

User management is now implemented as the real long-term provisioning path, not just a seed-only development helper.

### What admins can do

From the `User Management` screen, admin roles can:
- create a new user
- edit user details
- assign one or more roles
- assign wing / zone / office scope
- assign department / branch text
- activate or deactivate an account
- reset passwords
- require password change at next sign-in
- review recent audit activity linked to a user

### How to open the User Management panel

The admin panel route is:

- `/user-management`

Important:
- this route is protected
- only `SUPER_ADMIN` and `IT_OPS` can access it
- if you are not logged in, the app will redirect you to `/login`
- if you are logged in with a non-admin role such as `CLERK`, `REPORTING_OFFICER`, `COUNTERSIGNING_OFFICER`, `SECRET_BRANCH`, or `DG`, the app will not allow access to `/user-management`

Recommended way to navigate:

1. Open `http://localhost:3000/login`
2. Sign in with an admin-capable account such as:
   - `it.ops`
   - `![1775403300138](image/README/1775403300138.png)`
3. Use the shared development password:
   - `ChangeMe@123`
4. After login, open:
   - `http://localhost:3000/user-management`
5. Or use the left sidebar:
   - `Administration -> User Management`

If you are redirected back to login, check these items:

1. Confirm the backend is running on `http://localhost:4000`
2. Confirm the frontend is running on `http://localhost:3000`
3. Confirm you signed in with `SUPER_ADMIN` or `IT_OPS`, not a non-admin role
4. Confirm your browser accepted the auth cookies
5. If needed, sign out and sign in again, then open `/user-management`

If you want to verify your admin access quickly, use the seeded admin account:

| Name | Role | Login |
|---|---|---|
| Hamza Qureshi | `SUPER_ADMIN` and `IT_OPS` | `it.ops` or `it.ops@fia.gov.pk` |

### Admin-driven provisioning flow

```mermaid
sequenceDiagram
    participant Admin as Super Admin / IT Ops
    participant UI as User Management UI
    participant API as Backend Users API
    participant DB as Database

    Admin->>UI: Open User Management
    Admin->>UI: Create User
    UI->>API: POST /users
    API->>DB: Save user + roles + scope
    API->>DB: Write audit entry
    API-->>UI: Managed user payload
    UI-->>Admin: User created successfully
```

### How to create a new profile

1. Sign in as `SUPER_ADMIN` or `IT_OPS`
2. Open `/user-management`
3. Click `Create User`
4. Fill:
   - full name
   - badge number
   - username
   - email
   - mobile
   - department / branch
   - roles
   - wing / zone / office
   - temporary password
5. Choose:
   - `Account starts as active`
   - `Force password change on first login`
6. Save the user
7. Provide the internal credentials to the new account holder

### User management APIs

- `GET /users`
- `GET /users/options`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`
- `POST /users/:id/reset-password`
- `POST /users/:id/deactivate`
- `POST /users/:id/reactivate`

### UI implementation

Main UI files:
- [frontend/src/app/(portal)/user-management/page.tsx](frontend/src/app/(portal)/user-management/page.tsx)
- [frontend/src/components/users/UserManagementPage.tsx](frontend/src/components/users/UserManagementPage.tsx)

## Authentication and Password Lifecycle

### Supported auth flows

- direct login
- login challenge / verification flow
- logout
- session refresh
- role switching
- self password change
- admin password reset
- forgot-password request / token reset structure

### Password lifecycle

Admin reset flow:
1. admin opens a user
2. admin sets a temporary password
3. admin can force password change
4. user signs in
5. user is redirected to security settings if `mustChangePassword=true`

Self-service password change:
1. user signs in
2. opens settings security tab
3. provides current password and new password
4. password is updated
5. force-change requirement is cleared

Forgot-password endpoints:
- `POST /auth/forgot-password/request`
- `POST /auth/forgot-password/reset`

Important note:
- the structure is implemented safely
- actual email/SMS delivery integration is still a deployment concern

## Notifications, Audit, and Archive

### Notifications

Workflow notifications are routed to the correct next actor:
- Clerk to Reporting Officer
- Reporting Officer to Countersigning Officer
- Countersigning Officer to Secret Branch
- return notifications back to Clerk

### Audit logs

The audit screen is driven by real backend data and supports:
- action
- actor
- actor role
- record reference
- module / type
- timestamp
- IP address
- filtering and pagination

### Archive

Final records are preserved through archive snapshots for Secret Branch and authorized read-only access.

## PDF and Document Handling

The system includes:
- printable official form rendering
- PDF export path
- archive snapshot tracking
- signature and stamp asset support

Current implementation note:
- a server-side PDF exporter exists
- a client fallback was added for environments where local Chromium launch is restricted

In a normal unrestricted deployment environment, the expected behavior is:
- export current form data
- preserve the official form layout
- include saved signatures / stamps where available

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL
- optional Docker for local infra orchestration

### Install dependencies

```bash
pnpm install
```

### Backend setup

```bash
cd backend
pnpm prisma:generate
pnpm prisma:push
pnpm prisma:seed
pnpm start:dev
```

### Frontend setup

```bash
cd frontend
pnpm dev
```

### Run both from the repo root

```bash
pnpm dev
```

### Root commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm typecheck
pnpm db:generate
pnpm db:push
pnpm db:migrate
pnpm seed
pnpm docker:up
pnpm docker:down
```

## Environment Variables

### Root

[.env.example](.env.example)

```env
PNPM_HOME=.pnpm
```

### Backend

[backend/.env.example](backend/.env.example)

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/smart_acr?schema=public
JWT_ACCESS_SECRET=replace-with-a-long-access-secret
JWT_REFRESH_SECRET=replace-with-a-long-refresh-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
WEB_ORIGIN=http://localhost:3000
STORAGE_PATH=storage
```

### Frontend

[frontend/.env.example](frontend/.env.example)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## Seeded Accounts for Development

Seed data remains useful for local testing and demos, but it is no longer the only supported user creation path.

### Seed commands

```bash
pnpm seed
```

or:

```bash
cd backend
pnpm prisma:seed
```

### Shared development password

`ChangeMe@123`

### Seeded workflow accounts

| Name | Role | Email / Username | Purpose |
|---|---|---|---|
| Zahid Ullah | Clerk | `zahid.ullah@fia.gov.pk` | Clerk initiation flow |
| Muhammad Sarmad | Reporting Officer | `muhammad.sarmad@fia.gov.pk` | Reporting review |
| Afzal Khan SSP | Countersigning Officer | `afzal.khan@fia.gov.pk` | Countersigning review |
| Nazia Ambreen | Secret Branch | `nazia.ambreen@fia.gov.pk` | Archive / final receipt |
| Dr Anwar Saleem | DG | `dr.anwar.saleem@fia.gov.pk` | Executive read-only access |
| Hamza Qureshi | Super Admin / IT Ops | `it.ops@fia.gov.pk` and `it.ops` | Admin provisioning and technical operations |

### Internal onboarding rule

- privileged roles are not self-registered
- real user creation is handled through admin provisioning
- seeded users are bootstrap accounts for development and controlled setup

## Testing and Validation

### Current quality gates

The repository currently supports:
- backend Jest tests
- frontend component/form assertions
- workspace typecheck
- frontend build
- backend build
- API-driven live validation against real seeded data

### Core commands

```bash
pnpm --filter @smart-acr/backend test
pnpm --filter @smart-acr/frontend test
pnpm -r typecheck
pnpm --filter @smart-acr/frontend build
pnpm --filter @smart-acr/backend build
```

### Latest validation report

See:
- [docs/testing/system-validation-2026-04-05.md](docs/testing/system-validation-2026-04-05.md)

That report includes:
- complete scenario matrix
- pass / fail / blocked summary
- defects found and fixed
- live API revalidation notes

### Validation coverage already documented

The current test report covers:
- auth
- RBAC
- employee search
- full ACR workflow
- returned flow
- notifications
- audit logs
- admin / user management
- password lifecycle
- builds / typechecks

## Production Readiness Review

### Completed and in place

- full-stack role-based workflow application
- real backend-driven ACR lifecycle
- multiple official FIA template families
- historical visibility for acted-on records
- admin-driven internal user provisioning
- audit logging for sensitive operations
- archive and final-record handling
- notification routing
- dashboard / queue / search / archive experiences
- security-focused deny-by-default admin access

### Production-oriented strengths

- clear separation of frontend and backend concerns
- Prisma-backed relational model
- controller/service/helper structure on the backend
- App Router portal architecture on the frontend
- explicit role and workflow rules
- non-public privileged onboarding
- account lifecycle fields and admin change tracking

### Recommended production hardening

- connect forgot-password to real email/SMS delivery
- add stronger password policy if FIA policy requires it
- add dedicated CI integration tests for admin lifecycle and notification flows
- add stable browser-based end-to-end automation for the full ACR chain
- validate server-side PDF export in the target deployment environment
- move file storage to a managed object store where required
- formalize department/branch as a master table if governance needs expand

## Known Constraints and Follow-Up

Current follow-up items:
- server-side PDF generation can be environment-sensitive where local Chromium launch is restricted
- browser-level end-to-end coverage should be expanded further in CI or staging
- directory integration such as LDAP / Active Directory is still an optional future adapter

These are follow-up items, not blockers for the implemented admin/user-management foundation.

## Additional Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [Reuse and Migration Notes](docs/architecture/reuse-and-migration.md)
- [Workflow Rules](docs/architecture/workflow.md)
- [Testing Validation Report](docs/testing/system-validation-2026-04-05.md)
- [Official Form References](docs/forms/)
- [Project Proposal](docs/FIA_ACR_Project_Proposal_Revised_April_2026.pdf)
- [Software Requirements Specification](docs/FIA_ACR_SRS_Revised_April_2026.pdf)

## Maintainer Note

If you are onboarding this project for internal deployment, the recommended reading order is:

1. this root README
2. [docs/architecture/workflow.md](docs/architecture/workflow.md)
3. [docs/testing/system-validation-2026-04-05.md](docs/testing/system-validation-2026-04-05.md)
4. [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
5. [frontend/src/components/users/UserManagementPage.tsx](frontend/src/components/users/UserManagementPage.tsx)
6. [backend/src/modules/users/users.service.ts](backend/src/modules/users/users.service.ts)
