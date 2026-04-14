# Final Production Go-Live Gate Report

**Project:** FIA Smart ACR (Annual Confidential Report) Management System
**Date:** 2026-04-10
**Reviewer:** Automated Senior Technical Review (Phase 10 of 10)
**Previous Readiness Score:** 7.5/10 (Deployment Hardening Report)

---

## Executive Summary

The Smart ACR system is a government-grade workflow management system for FIA (Federal Investigation Agency) Annual Confidential Reports. After reviewing all 10 phases of hardening and the complete codebase across architecture, database, backend, frontend, security, testing, observability, deployment, workflow integrity, role/access control, performance, and maintainability, **the system is assessed as READY WITH CONDITIONS**.

The core workflow engine, authentication, authorization, and observability stack are production-grade. However, several issues must be resolved before go-live to prevent data integrity risks and security exposure in a government environment.

**Updated Readiness Score: 7.0/10** (downgraded from 7.5 due to archive integrity and testing gaps discovered in this deeper review)

---

## 1. Production Blockers (MUST FIX before go-live)

These items represent unacceptable risk in a government/FIA production environment.

### BLOCKER-1: Archive Immutability is Placeholder Only
- **Severity:** CRITICAL
- **Location:** `backend/src/modules/acr/acr.service.ts` (lines 537-550)
- **Issue:** `checksum` and `immutableHash` fields on archive snapshots use placeholder string values instead of real cryptographic hashes (SHA-256). No hash verification occurs on retrieval. This means archived government records have no tamper detection.
- **Impact:** Archive records could be modified without detection. For a government confidential reporting system, this is a compliance and audit failure.
- **Fix:** Implement SHA-256 hashing of the full form data JSON + document path at archive time. Verify hash on every retrieval.

### BLOCKER-2: Seed Script Can Run in Production
- **Severity:** CRITICAL
- **Location:** `backend/prisma/seed.ts` (lines 14-15, 55-71)
- **Issue:** The seed script has no `NODE_ENV` guard. It uses a hardcoded password and unconditionally calls `resetDatabase()` which deletes ALL data. The release pipeline has a `run_seed` input flag that could be triggered in production.
- **Impact:** Accidental or malicious seed execution would destroy all production data and create demo accounts with known passwords.
- **Fix:** Add environment guard to prevent execution in production. Remove `run_seed` option from production release workflow. Use env var for demo password.

### BLOCKER-3: Diagnostics Endpoint Unauthenticated
- **Severity:** CRITICAL
- **Location:** `backend/src/modules/health/health.controller.ts` (`/api/v1/health/diagnostics`)
- **Issue:** The diagnostics endpoint exposes database connection status, memory usage, uptime, and system configuration without any authentication.
- **Impact:** Information disclosure to unauthenticated attackers. Reveals internal architecture details.
- **Fix:** Add JWT auth guard with SUPER_ADMIN/IT_OPS role restriction.

### BLOCKER-4: Asset Validation Checks Field Name, Not Actual File
- **Severity:** HIGH
- **Location:** `backend/src/modules/acr/acr-form-validation.ts` (lines 44-52, 94-105)
- **Issue:** `hasReplicaAssetValue()` checks if the field key exists in form data, but does not verify the referenced file actually exists in the FileAsset table. A user could submit an empty or null asset reference and pass validation.
- **Impact:** ACRs could be archived without actual signatures/stamps, violating FIA workflow requirements.
- **Fix:** Cross-reference asset field values against FileAsset table to verify file existence before allowing transitions.

### BLOCKER-5: No Security Headers (Helmet) on Backend
- **Severity:** HIGH
- **Location:** `backend/src/main.ts`
- **Issue:** Helmet.js is listed as a dependency but is NOT applied in `main.ts`. The backend serves responses without X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, or Content-Security-Policy headers. While Nginx adds some headers, direct backend access (internal network, development) has no protection.
- **Impact:** Clickjacking, MIME sniffing, and other header-based attacks possible on direct backend access.
- **Fix:** Add `app.use(helmet())` to `main.ts` bootstrap.

---

## 2. High-Risk but Non-Blocking Concerns

These should be addressed within the first sprint after go-live (Week 1-2).

### HIGH-1: No Rate Limiting on Auth Endpoints
- **Location:** Backend - no `@nestjs/throttler` configured
- **Issue:** Login, OTP verification, and password reset endpoints have no rate limiting.
- **Risk:** Brute force attacks on login, OTP spray, password reset abuse.
- **Recommendation:** Implement `@nestjs/throttler` with strict limits on auth endpoints.

### HIGH-2: CSP Allows unsafe-inline and unsafe-eval
- **Location:** `infra/docker/nginx/nginx.conf`
- **Issue:** script-src allows unsafe-inline and unsafe-eval, which are primary XSS vectors.
- **Recommendation:** Replace with nonce-based CSP.

### HIGH-3: No Controller/Integration Tests
- **Location:** Backend test suite
- **Issue:** 16 service spec files exist but 0 controller tests. No HTTP endpoint integration tests. No E2E tests.
- **Risk:** Service logic is tested but API contracts, middleware, guard enforcement, and error responses are untested.

### HIGH-4: Rollback Has No Database Recovery
- **Location:** `infra/scripts/rollback-onprem.sh`
- **Issue:** Rollback only swaps Docker images. If a migration altered the schema, the old image may be incompatible.
- **Recommendation:** Implement pre-deploy DB snapshot. Rollback should restore snapshot if migration occurred.

### HIGH-5: Backup Failure Does Not Stop Deployment
- **Location:** `infra/scripts/deploy-onprem.sh` (lines 37-39)
- **Issue:** Pre-deploy backup failures emit a warning but deployment continues.
- **Recommendation:** Make backup success mandatory before proceeding.

### HIGH-6: Unbounded ACR List Queries
- **Location:** `backend/src/modules/acr/acr.service.ts` (line 71), dashboard service
- **Issue:** ACR list endpoint fetches ALL records, then filters in JavaScript. No server-side pagination.
- **Risk:** With thousands of ACRs, response times degrade and memory spikes.

### HIGH-7: SUPER_ADMIN Can Transition Archived Records
- **Location:** `backend/src/helpers/security.utils.ts` (lines 190-192)
- **Issue:** `canTransitionAcr()` returns true for SUPER_ADMIN/IT_OPS regardless of workflow state, including ARCHIVED.
- **Recommendation:** Add explicit archived-state guard before admin bypass.

---

## 3. Medium/Low Concerns

Address within the first 30 days post-launch.

### MEDIUM-1: No CSRF Token Implementation
- Relies solely on SameSite=lax cookies. No explicit CSRF tokens.
- SameSite=lax provides baseline protection. Add tokens in hardening sprint.

### MEDIUM-2: Frontend Hardcoded Localhost Fallback
- `frontend/src/api/client.ts` falls back to localhost if env var is unset.
- Fix: Fail loudly if NEXT_PUBLIC_API_URL is undefined at build time.

### MEDIUM-3: Demo Token Visible in Password Reset UI
- `frontend/src/app/forgot-password/page.tsx` displays demo reset token.
- Gate behind NODE_ENV check.

### MEDIUM-4: No Coverage Thresholds in CI
- Jest runs but no minimum coverage enforced.
- Set coverageThreshold at 60% minimum.

### MEDIUM-5: No Login Field Length Limits
- `backend/src/modules/auth/dto/login.dto.ts` has no MaxLength on fields.
- Risk: DoS via extremely large payloads.

### MEDIUM-6: Timeline/AuditLog Includes Are Unbounded
- Related records loaded without `take` limits in list operations.
- Add `take: 25` limits.

### MEDIUM-7: No Soft Delete Pattern
- All deletions are hard deletes. No deletedAt fields on sensitive models.
- Consider for compliance requirements.

### LOW-1: No Loading Skeletons on Frontend
- Loading states show basic text instead of skeleton UIs. UX concern only.

### LOW-2: No Dynamic Code Splitting
- PDF libraries (jspdf, html2canvas) loaded eagerly. ~500KB unnecessary on non-PDF pages.

### LOW-3: Return-to-Clerk Has No Retry Limit
- ACRs can cycle return-submit-return indefinitely.

---

## 4. Final Go-Live Checklist

### Pre-Go-Live (Must Complete)

| # | Item | Status |
|---|------|--------|
| 1 | Implement SHA-256 archive checksums and verification | REQUIRED |
| 2 | Add NODE_ENV guard to seed script | REQUIRED |
| 3 | Remove run_seed from production release workflow | REQUIRED |
| 4 | Add auth guard to /diagnostics endpoint | REQUIRED |
| 5 | Validate asset files exist (not just field names) | REQUIRED |
| 6 | Apply Helmet middleware in main.ts | REQUIRED |
| 7 | Run npm audit and resolve critical/high vulnerabilities | REQUIRED |
| 8 | Generate and review TLS certificates for production domain | REQUIRED |
| 9 | Set production environment variables (JWT secrets, DB URL, WEB_ORIGIN) | REQUIRED |
| 10 | Verify .env files are NOT committed to repository | REQUIRED |
| 11 | Run full migration on staging with production-like data | REQUIRED |
| 12 | Execute backup and restore test on staging | REQUIRED |
| 13 | Verify all Docker resource limits are set | VERIFIED |
| 14 | Test rollback procedure on staging | REQUIRED |
| 15 | Remove hardcoded demo email from login placeholder | REQUIRED |

### Go-Live Day

| # | Item | Action |
|---|------|--------|
| 1 | Take pre-deployment database backup | Ops |
| 2 | Verify backup integrity (gunzip test, size check) | Ops |
| 3 | Deploy to production using release workflow | DevOps |
| 4 | Verify migration success | DevOps |
| 5 | Run post-deploy smoke tests | Automated |
| 6 | Verify health endpoints: /health, /health/ready | Ops |
| 7 | Test login flow with production credentials | QA |
| 8 | Test ACR creation and first transition | QA |
| 9 | Test file upload (signature/stamp) | QA |
| 10 | Verify Grafana dashboards receiving metrics | Ops |
| 11 | Verify Loki receiving logs | Ops |
| 12 | Confirm error rates below threshold | Ops |

### Post-Go-Live (Week 1)

| # | Item | Priority |
|---|------|----------|
| 1 | Implement rate limiting on auth endpoints | HIGH |
| 2 | Fix CSP to remove unsafe-inline/unsafe-eval | HIGH |
| 3 | Add controller integration tests for critical flows | HIGH |
| 4 | Make backup failure block deployment | HIGH |
| 5 | Add database snapshot to rollback procedure | HIGH |
| 6 | Block SUPER_ADMIN from transitioning ARCHIVED records | HIGH |
| 7 | Add pagination to ACR list endpoint | HIGH |
| 8 | Add CSRF tokens | MEDIUM |
| 9 | Fail build if NEXT_PUBLIC_API_URL undefined | MEDIUM |
| 10 | Add max length to login DTO fields | MEDIUM |

---

## 5. Final Verdict

### READY WITH CONDITIONS

The Smart ACR system demonstrates strong architectural foundations:
- Well-structured NestJS monorepo with clear module boundaries
- Comprehensive role-based access control with organizational scoping
- Complete CI/CD pipeline with Docker-based deployment
- Observability stack (Prometheus, Grafana, Loki) configured
- Audit logging on all sensitive operations
- Session management with proper revocation
- File upload security with MIME validation and path traversal prevention

**However, 5 blockers must be resolved before production deployment:**

1. Archive checksums are placeholders (government compliance failure)
2. Seed script can destroy production data
3. Diagnostics endpoint exposes system info without auth
4. Asset validation does not verify actual files exist
5. Helmet security headers not applied to backend

**Estimated effort to clear blockers: 2-3 engineering days.**

Once blockers are resolved, the system is safe for initial production deployment with a limited user base (pilot rollout recommended), followed by the 30-day hardening roadmap below.

---

## 6. Recommended 30-Day Hardening Roadmap

### Week 1: Security Hardening
- [ ] Implement rate limiting (@nestjs/throttler) on all auth endpoints
- [ ] Fix CSP policy (remove unsafe-inline, unsafe-eval; use nonces)
- [ ] Add CSRF token implementation
- [ ] Block admin transitions on ARCHIVED records
- [ ] Add MaxLength validation to all DTO string fields
- [ ] Tighten Grafana default password (change from admin/admin)
- [ ] Enable Docker image scanning (Trivy) in CI pipeline

### Week 2: Data Safety and Performance
- [ ] Add pagination to ACR list and dashboard endpoints
- [ ] Add take limits to all Prisma relation includes
- [ ] Move access control filtering to Prisma WHERE clauses
- [ ] Make backup failure block deployment in deploy script
- [ ] Add database snapshot step before migrations
- [ ] Implement backup rotation (14-day retention enforced)
- [ ] Add log rotation to Docker compose logging config
- [ ] Test disaster recovery: full backup + restore drill

### Week 3: Testing and Quality
- [ ] Add controller integration tests for auth, ACR lifecycle, archive, users
- [ ] Add E2E tests for critical workflows (Playwright)
- [ ] Set coverage thresholds (60% minimum) in CI
- [ ] Add frontend component tests for forms and auth
- [ ] Fail CI build on npm audit high/critical vulnerabilities
- [ ] Add SBOM generation to release pipeline
- [ ] Document first-deployment runbook with step-by-step instructions

### Week 4: Operational Maturity
- [ ] Implement expand-contract migration pattern for zero-downtime schema changes
- [ ] Add approval gates (GitHub environment protection rules) for production deploys
- [ ] Set up alerting rules in Grafana (error rate, latency, disk usage)
- [ ] Create support/debug process documentation
- [ ] Define monitoring ownership and on-call rotation
- [ ] Schedule quarterly restore drills
- [ ] Pin Docker base images by digest (supply chain safety)
- [ ] Add container read-only filesystem support
- [ ] Document password reset and admin recovery procedures
- [ ] Create production smoke test suite (beyond health checks)

---

## Appendix A: Component Readiness Matrix

| Component | Ready | Notes |
|-----------|-------|-------|
| Architecture | YES | Clean monorepo, clear module boundaries |
| Database Schema | YES | Proper relations, indexes, enums |
| Database Migrations | YES | Ordered, additive, reversible |
| Backend API | CONDITIONAL | Needs Helmet, rate limiting, pagination |
| Authentication | YES | JWT + sessions, bcrypt, token rotation |
| Authorization | YES | Role guards, scope filtering, audit |
| Workflow Engine | CONDITIONAL | Needs archive hash fix, asset validation |
| Frontend App | YES | Functional, needs minor hardening |
| File Storage | YES | MIME validation, path traversal protection |
| Archive System | NO | Placeholder checksums (BLOCKER) |
| Observability | YES | Prometheus, Grafana, Loki, structured logging |
| CI/CD Pipeline | CONDITIONAL | Needs audit enforcement, coverage gates |
| Deployment Scripts | CONDITIONAL | Needs backup-must-succeed, migration timeout |
| Rollback | PARTIAL | Image-only rollback, no DB recovery |
| Backup/Restore | YES | Scripts exist, need automated testing |
| Security Headers | NO | Helmet not applied (BLOCKER) |
| Rate Limiting | NO | Not implemented |
| Monitoring/Alerting | PARTIAL | Stack deployed, no alert rules defined |

## Appendix B: Risk Register Summary

| ID | Risk | Severity | Likelihood | Status |
|----|------|----------|------------|--------|
| B1 | Archive tamper undetectable | CRITICAL | Medium | BLOCKER |
| B2 | Seed destroys production data | CRITICAL | Low | BLOCKER |
| B3 | System info exposed via /diagnostics | CRITICAL | High | BLOCKER |
| B4 | Invalid signatures pass validation | HIGH | Medium | BLOCKER |
| B5 | No security headers on backend | HIGH | Medium | BLOCKER |
| H1 | Auth brute force | HIGH | Medium | Open |
| H2 | XSS via weak CSP | HIGH | Low | Open |
| H3 | Untested API contracts | HIGH | Medium | Open |
| H4 | Rollback breaks on schema change | HIGH | Low | Open |
| H5 | Backup failure + deploy failure = no recovery | HIGH | Low | Open |
| H6 | Memory exhaustion from unbounded queries | HIGH | Medium | Open |
| H7 | Admin modifies archived record | MEDIUM | Low | Open |
| M1 | CSRF on older browsers | MEDIUM | Low | Open |
| M2 | Frontend hits localhost in production | MEDIUM | Low | Open |
| M3 | No coverage enforcement | MEDIUM | N/A | Open |

---

*Report generated as part of the 10-phase production hardening pipeline.*
*Next action: Resolve 5 blockers, then proceed with pilot rollout.*
