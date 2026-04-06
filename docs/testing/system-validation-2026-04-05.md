# FIA Smart ACR / PER System Validation

Date: 2026-04-05  
Environment: local Windows workspace, frontend Next.js app, backend NestJS API, real Prisma-backed seed data  
Test mode: automated + API-driven end-to-end execution + targeted runtime simulation

## Coverage Summary

- Modules covered:
  - authentication
  - role-based access control
  - employee search
  - ACR creation and workflow transitions
  - returned-to-clerk correction flow
  - historical visibility after workflow progression
  - notifications
  - audit logs
  - admin / user management
  - password lifecycle
  - frontend build / type generation / form-template checks
  - backend unit/service tests
- Total scenarios documented: 23
- Executed directly: 22
- Simulated/code-path validated: 1

## Test Case Matrix

| ID | Module | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| AUTH-001 | Authentication | Clerk login with seeded account | Seeded data loaded | POST `/auth/login` with `zahid.ullah@fia.gov.pk` | Authenticated session with Clerk scope returned | Session returned successfully | Pass | Critical | Cookie-based session created |
| AUTH-002 | Authentication | Invalid login blocked | None | POST `/auth/login` with wrong password | `401` unauthorized | `401` returned | Pass | High | Verified backend auth protection |
| AUTH-003 | Authentication | Admin-created user logs in with temporary password | Admin-created user exists | POST `/auth/login` for `test.workflow` with temp password | Session returned with `mustChangePassword=true` | Returned correctly | Pass | High | Validated first-login enforcement flag |
| AUTH-004 | Authentication | Deactivated user cannot log in | User deactivated by admin | POST `/auth/login` with reset password | `401` unauthorized | `401` returned | Pass | Critical | Existing data remains intact |
| AUTH-005 | Password Lifecycle | User changes own password | Authenticated test user | PATCH `/settings/security/password` with current + new password | Password updated and force-change cleared | Success response returned | Pass | High | Verified follow-up login with new password |
| AUTH-006 | Forgot Password | Recovery request returns safe generic response | Forgot-password flow available structurally | POST `/auth/forgot-password/request` | Generic success response without account leakage | Generic success response returned | Pass | Medium | Token delivery integration still environment-driven |
| RBAC-001 | Access Control | Clerk cannot access user management API | Clerk authenticated | GET `/users` | `403` forbidden | `403` returned | Pass | Critical | Server-side enforcement confirmed |
| RBAC-002 | Access Control | DG cannot edit ACR or access user management API | DG authenticated | PATCH `/acrs/:id/form-data`, GET `/users` | Both blocked | Both returned `403` | Pass | Critical | Read-only role remains read-only |
| RBAC-003 | Historical Visibility | Clerk can still view archived ACR they initiated | Test ACR archived | GET `/acrs/:id` as Clerk | Read-only detail still accessible | `200` returned | Pass | High | Historical visibility working |
| RBAC-004 | Historical Visibility | Reporting Officer can still view archived acted-on ACR | Test ACR archived | GET `/acrs/:id` as RO | Read-only detail still accessible | `200` returned | Pass | High | History retained |
| RBAC-005 | Historical Visibility | Countersigning Officer can still view archived acted-on ACR | Test ACR archived | GET `/acrs/:id` as CSO | Read-only detail still accessible | `200` returned | Pass | High | History retained |
| RBAC-006 | Historical Visibility | Secret Branch can view archived final ACR | Test ACR archived | GET `/acrs/:id` as Secret Branch | Archived detail accessible | `200` returned | Pass | High | Archive visibility confirmed |
| EMP-001 | Employee Search | Search by employee name during initiation | Clerk authenticated | GET `/employees?query=fatima` | Matching employee returned | Fatima Zahra returned correctly | Pass | High | Search + scope filter both working |
| ACR-001 | Workflow | Clerk creates new ACR draft | Clerk authenticated, employee exists | POST `/acrs` with Fatima employee ID | Draft ACR created with correct template and seed form data | Draft created successfully | Pass | Critical | Real DB record created |
| ACR-002 | Workflow | Clerk submits draft to Reporting Officer | Draft exists | POST `/acrs/:id/transition` action `submit_to_reporting` | Current holder changes to Reporting Officer | Transition succeeded | Pass | Critical | Notification created for RO |
| ACR-003 | Workflow | Reporting Officer updates form and returns to Clerk | Pending reporting ACR exists | PATCH form data, POST `return_to_clerk` | Returned status set and Clerk becomes current holder | Worked correctly | Pass | Critical | Return reason preserved |
| ACR-004 | Returned Flow | Clerk corrects returned ACR and resubmits | Returned ACR exists | PATCH form data, POST `submit_to_reporting` | Clerk edits allowed; resubmission succeeds | Worked correctly | Pass | Critical | Timeline shows `resubmitted to reporting` |
| ACR-005 | Workflow | Reporting Officer forwards corrected ACR to Countersigning Officer | Resubmitted ACR exists | POST `forward_to_countersigning` | Current holder changes to CSO | Worked correctly | Pass | Critical | RO-entered data remained visible |
| ACR-006 | Workflow | Countersigning Officer updates form and submits to Secret Branch | Pending countersigning ACR exists | PATCH form data, POST `submit_to_secret_branch` | Archived/final state reached | Worked correctly | Pass | Critical | Archive snapshot created |
| ACR-007 | Form Persistence | Higher workflow stages see earlier filled data | Returned/resubmitted ACR exists | GET detail as RO/CSO after previous edits | Clerk + RO data both visible | Verified in returned and countersigning detail payloads | Pass | Critical | Confirms cross-stage binding |
| NOTIF-001 | Notifications | Workflow notifications route to correct next user | Workflow actions executed | GET `/notifications` as RO | Assignment and corrected-resubmission notifications appear | Correct notifications present | Pass | High | No wrong-role leak observed in tested path |
| NOTIF-002 | Notifications | Mark all read updates unread state | RO has unread notifications | POST `/notifications/read-all`, then GET unread filter | Unread list becomes empty | Worked correctly on sequential retest | Pass | Medium | Initial parallel check was a false read due race in test execution |
| AUD-001 | Audit Logs | User-management and workflow actions appear in audit trail | Actions executed | GET `/audit?query=test.workflow&pageSize=5` | User create/reset/deactivate/login entries visible | Returned correctly with actor, role, module, IP, timestamps | Pass | High | Real backend audit data confirmed |
| ADM-001 | User Management | Admin creates a new real user | Admin authenticated | POST `/users` | New user created with role/scope | Worked correctly | Pass | Critical | Bootstrap no longer seed-only |
| ADM-002 | User Management | Admin resets password and reactivation lifecycle works | Test user exists | POST reset password, POST deactivate, POST reactivate | Password reset audited; deactivated login blocked; reactivated login restored | Worked correctly | Pass | Critical | Must-change-password preserved after admin reset |
| BUILD-001 | Backend Quality Gate | Backend unit/service tests pass | Code patched | `pnpm --filter @smart-acr/backend test` | All tests pass | 4 suites, 20 tests passed | Pass | High | Auth spec mocks updated |
| BUILD-002 | Frontend Quality Gate | Frontend form-template checks pass | Code patched | `pnpm --filter @smart-acr/frontend test` | Assertions pass | Passed | Pass | High | Runner adapted for Windows sandbox |
| BUILD-003 | Type/Build Gate | Workspace typecheck + builds pass | Code patched | `pnpm -r typecheck`, frontend build, backend build | All complete successfully | Passed after typegen cleanup fix | Pass | High | `.next/types` cleanup added |
| PDF-001 | PDF Export | Export current filled ACR as PDF | Filled ACR exists | Trigger server PDF route, then fallback path review | Filled-form PDF should be downloadable | Server route failed in this environment with Playwright `spawn EPERM`; client-side fallback implemented in ACR page | Blocked | High | Manual browser click on export fallback still recommended in an unrestricted local session |

## Defects Found And Fixed During Validation

### DEF-001 — Backend auth automated tests failed after login lifecycle changes
- Severity: High
- Root cause: `AuthService` now updates `user.lastLoginAt` and writes audit logs on login, but the existing Jest Prisma mocks in `auth.service.spec.ts` did not include `user.update` and `auditLog.create`.
- Fix applied:
  - patched `backend/src/modules/auth/auth.service.spec.ts`
- Retest result: passed

### DEF-002 — Frontend test runner failed in Windows sandbox
- Severity: High
- Root cause: `tsx --test` and Node’s test runner path both relied on subprocess behavior that triggered `spawn EPERM` in this environment, and ESM resolution for compiled spec files was unstable.
- Fix applied:
  - added `frontend/tsconfig.spec.json`
  - changed `frontend/package.json` test script to use plain TypeScript compilation plus a direct CommonJS assertion script
  - converted `form-templates.spec.tsx` to direct assertions
- Retest result: passed

### DEF-003 — FIA logo API route used a brittle path
- Severity: Medium
- Root cause: the route only resolved `../file_logo.svg`, which breaks depending on the process working directory.
- Fix applied:
  - patched `frontend/src/app/api/assets/fia-logo/route.ts` to probe both project-root candidates safely
- Retest result: build passed; route now resolves robustly

### DEF-004 — Frontend typecheck could fail on stale `.next/types`
- Severity: Medium
- Root cause: `tsc` was matching stale generated route-type files left in `.next/types`.
- Fix applied:
  - patched `frontend/package.json` typecheck script to clear `.next/types` before `next typegen`
- Retest result: passed

### DEF-005 — Server-side PDF export fails under restricted process launch
- Severity: High
- Root cause: `frontend/src/app/api/acr/[id]/pdf/route.ts` depends on `playwright-core` launching Chromium/Edge. In this environment the launch fails with `spawn EPERM`.
- Fix applied:
  - added client-side PDF fallback in `frontend/src/app/(portal)/acr/[id]/page.tsx` using the live form replica DOM
  - kept the server exporter as primary path for environments where Chromium launch is allowed
- Retest result: server route remains environment-blocked; fallback implementation typechecked and built successfully

### DEF-006 — User-facing role labels for `DG` / `IT Ops` were inconsistently title-cased
- Severity: Low
- Root cause: generic underscore splitting turned `DG` into `Dg`.
- Fix applied:
  - patched role display helpers in:
    - `backend/src/helpers/security.utils.ts`
    - `backend/src/modules/auth/auth.service.ts`
    - `backend/src/modules/settings/settings.service.ts`
- Retest result: passed in live API responses

## Command Evidence

- `pnpm --filter @smart-acr/backend test` → passed
- `pnpm --filter @smart-acr/frontend test` → passed
- `pnpm -r typecheck` → passed
- `pnpm --filter @smart-acr/frontend build` → passed
- `pnpm --filter @smart-acr/backend build` → passed

## Revalidation Update

Date: 2026-04-05  
Purpose: second-pass validation after the user-management completion review

### Additional Live Checks Executed

| ID | Module | Scenario | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| RECHECK-001 | Authentication | Super Admin login via live API | Valid admin session returned | `201` returned with `SUPER_ADMIN` active role and scoped session payload | Pass | Cookie-based session confirmed |
| RECHECK-002 | Authentication | Clerk login via live API | Valid clerk session returned | `201` returned with `CLERK` active role and scoped session payload | Pass | Session payload includes `mustChangePassword` |
| RECHECK-003 | Forgot Password | Unknown identifier request stays generic | No account-existence leakage | Generic success message returned | Pass | Confirms safe public response |
| RECHECK-004 | User Management API | Admin can list users with real lifecycle fields | User list returns real managed accounts | `200` returned with `createdAt`, `updatedAt`, `lastLoginAt`, scope, and roles | Pass | Confirms admin list payload completeness |
| RECHECK-005 | User Management API | Admin can load options for roles and scope | Roles/wings/zones/offices returned | `200` returned with full option payload | Pass | `DG` and `IT Ops` labels verified |
| RECHECK-006 | Access Control | Clerk remains blocked from user management API | `403` forbidden | `403` returned | Pass | Server-side restriction still enforced |

### Additional Completion Fix Applied

#### DEF-007 — Admin UI did not surface lifecycle fields clearly
- Severity: Low
- Root cause: the backend already returned `createdAt`, `updatedAt`, and `lastLoginAt`, but the admin user-management screen did not present that lifecycle information clearly enough to satisfy the original requirement.
- Fix applied:
  - patched `frontend/src/components/users/UserManagementPage.tsx`
  - user list now shows created / updated / last-login lifecycle details
  - user detail drawer now includes a dedicated lifecycle section
- Retest result:
  - `pnpm --filter @smart-acr/frontend typecheck` → passed
  - `pnpm --filter @smart-acr/frontend build` → passed

## Follow-Up Recommendations

- Run one manual browser export click in an unrestricted local session to confirm the new client-side PDF fallback output visually.
- Add dedicated backend/API integration tests for the notification `read-all` and admin-user lifecycle so those live API checks become part of CI.
- Add an automated end-to-end harness for the core Clerk → Reporting → Countersigning → Secret Branch workflow when a stable browser runner is available.
