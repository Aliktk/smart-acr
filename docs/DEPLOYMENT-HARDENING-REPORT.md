# Deployment, Release, CI/CD & Production Hardening Report

**Date:** 2026-04-10
**Scope:** Full production readiness assessment of smart-acr project

---

## Executive Summary

The smart-acr project has a **solid foundation** for on-prem production deployment. The infrastructure includes Docker Compose orchestration, CI/CD via GitHub Actions, scripted deploy/rollback/backup/restore, nginx reverse proxy with TLS, health checks, monitoring (Prometheus/Loki/Grafana), and comprehensive release documentation. Several targeted improvements would close the remaining gaps for hardened production operations.

**Overall Release-Readiness Score: 7.5/10**

---

## 1. Release/Deployment Risks

### 1.1 CRITICAL Risks

| Risk | Impact | Current State |
|------|--------|---------------|
| No pre-deploy backup in CI workflow | Data loss on failed migration | `deploy-onprem.sh` does not call `backup-onprem.sh` before migrating |
| Rollback does not handle migration rollbacks | Schema may be incompatible with previous image | Rollback script only swaps images, no migration revert |
| `.dockerignore` excludes `.env.*` but dev `.env` files are committed | Potential secret leak if pattern changes | `backend/.env` and `frontend/.env` exist in repo (gitignored at root but present on disk) |
| `diagnostics` endpoint has no auth guard | Exposes node version, memory, env name publicly | `HealthController.getDiagnostics()` is unauthenticated |

### 1.2 HIGH Risks

| Risk | Impact | Current State |
|------|--------|---------------|
| No image digest pinning | Supply-chain risk from tag mutation | Compose files use `${IMAGE_TAG:-latest}` without digest |
| No database connection pool limits | Connection exhaustion under load | Prisma default pool size with no explicit configuration |
| CI does not run security scanning | Vulnerable dependencies may ship | No `npm audit`, Trivy, or Snyk step in `ci.yml` |
| No container resource limits | OOM or CPU starvation possible | `docker-compose.onprem.yml` has no `deploy.resources` |
| Monitoring compose uses default Grafana password | Unauthorized dashboard access | `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-change-me-grafana}` |

### 1.3 MEDIUM Risks

| Risk | Impact | Current State |
|------|--------|---------------|
| No log rotation for container logs | Disk exhaustion over time | No `logging` driver config in compose |
| No automated backup verification | Backups may be corrupt/empty | `backup-onprem.sh` does not validate backup integrity |
| Smoke test only checks HTTP 200 | Shallow post-deploy validation | `post-deploy-smoke.sh` only curls health + root |
| CSP allows `unsafe-inline` and `unsafe-eval` for scripts | XSS mitigation weakened | nginx conf `script-src 'self' 'unsafe-inline' 'unsafe-eval'` |
| Redis marked as optional profile | Cache unavailable by default | Redis uses `profiles: ["cache"]`, not started in standard deploy |

---

## 2. CI/CD Improvements

### 2.1 Current CI Pipeline (`ci.yml`)

**Strengths:**
- Concurrency group prevents parallel runs on same ref
- Frozen lockfile ensures reproducible installs
- Lint, typecheck, test, build, and Docker build all present
- 35-minute timeout prevents hung jobs

**Gaps and Recommendations:**

| Area | Current | Recommendation |
|------|---------|----------------|
| Security scanning | None | Add `npm audit --audit-level=high` step after install |
| Container scanning | None | Add Trivy scan after Docker build |
| Test coverage reporting | No coverage output | Add `--coverage` flag and upload artifact |
| Artifact caching | pnpm cache only | Add Docker layer caching with `docker/build-push-action` |
| Branch protection | Not enforced in workflow | Add required status checks in GitHub branch settings |
| Matrix testing | Single Node version | Consider Node 22 LTS matrix for future compat |

### 2.2 Release Pipeline (`release-onprem.yml`)

**Strengths:**
- Manual trigger with environment selection
- Image tag from git SHA ensures traceability
- Environment-specific secrets via GitHub environments
- Release env artifact uploaded for audit trail
- Self-hosted runner for on-prem deploy

**Gaps and Recommendations:**

| Area | Current | Recommendation |
|------|---------|----------------|
| Pre-deploy backup | Not included | Add backup step before migration |
| CI gate | No dependency on CI passing | Add `needs: ci` or require CI check |
| Image signing | None | Consider cosign for supply-chain integrity |
| Deploy approval | GitHub environment protection rules | Verify required reviewers configured for `production` environment |
| Notification | None | Add Slack/email notification on deploy success/failure |
| Smoke test result | Exit code only | Capture smoke test output as artifact |

### 2.3 Rollback Pipeline (`rollback-onprem.yml`)

**Strengths:**
- Clean separation from deploy workflow
- Uses `previous-release.env` for state tracking
- Runs smoke test after rollback

**Gap:** No migration rollback capability. If a migration added columns or changed schema, the previous image may not be compatible.

---

## 3. Deployment Hardening Changes

### 3.1 Docker/Container Hardening

**Already Implemented (Good):**
- Multi-stage builds with minimal runtime images
- Non-root user (`smartacr:1001`)
- `no-new-privileges` security option
- `tmpfs` for `/tmp`
- Internal Docker network isolation
- Health checks on all services
- `server_tokens off` in nginx

**Recommendations:**

1. **Add resource limits** to `docker-compose.onprem.yml`:
   ```yaml
   backend:
     deploy:
       resources:
         limits:
           cpus: '2.0'
           memory: 1G
         reservations:
           cpus: '0.5'
           memory: 256M
   ```

2. **Add log rotation**:
   ```yaml
   backend:
     logging:
       driver: json-file
       options:
         max-size: "50m"
         max-file: "5"
   ```

3. **Pin base images by digest** in Dockerfiles for reproducibility.

4. **Add `read_only: true`** to backend/frontend containers where possible.

### 3.2 Nginx Hardening

**Already Implemented (Good):**
- HTTPS redirect
- HSTS with preload
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- CSP header
- Rate limiting (15r/s with burst 30)
- TLS 1.2/1.3 only with strong ciphers
- `client_max_body_size 20m`
- Stub status restricted to internal IPs
- Proxy retry on 502/503

**Recommendations:**

1. **Tighten CSP**: Remove `'unsafe-inline'` and `'unsafe-eval'` from `script-src` when possible, use nonce-based CSP.
2. **Add `ssl_stapling`** for OCSP:
   ```
   ssl_stapling on;
   ssl_stapling_verify on;
   ```
3. **Add request body timeout**: `client_body_timeout 30s;`

### 3.3 Environment Configuration

**Already Implemented (Good):**
- Zod-based env validation at startup (`config/env.ts`)
- Separate env files for backend/frontend
- Secrets stored in GitHub Actions environment secrets
- `.gitignore` excludes `infra/docker/env/*.env` and `infra/state/*.env`

**Recommendations:**

1. **Add `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`** to the Zod validation schema (currently only `DATABASE_URL` is validated).
2. **Enforce minimum JWT secret length** at 32+ characters in production (currently 16 minimum).
3. **Add `LOG_LEVEL` env var** for runtime log verbosity control.
4. **Protect diagnostics endpoint** with JWT auth guard in production.

### 3.4 Secret Handling

**Already Implemented (Good):**
- `.dockerignore` excludes `.env` files
- GitHub environment secrets for production/staging
- No secrets hardcoded in compose files (uses env_file)

**Recommendations:**

1. **Audit `backend/.env`** — the file on disk contains `DATABASE_URL=postgresql://postgres:1122@127.0.0.1:5432/...` with a password. Ensure this is only for local dev.
2. **Rotate default passwords** in all env examples and compose defaults.
3. **Consider Docker secrets** or external secret manager for production passwords.

---

## 4. Migration/Rollback Recommendations

### 4.1 Migration Safety

**Current State:**
- Prisma Migrate with `migrate deploy` for production
- 10 migration files, well-organized by date
- Separate `migrate` service in compose with `profiles: ["ops"]`
- Deploy script runs migration before starting services

**Recommendations:**

1. **Pre-deploy backup**: Add automatic backup call before migration in `deploy-onprem.sh`:
   ```bash
   echo "Creating pre-deploy backup..."
   bash "${ROOT_DIR}/infra/scripts/backup-onprem.sh"
   ```

2. **Migration review gate**: Add migration diff review step in CI:
   ```yaml
   - name: Check for pending migrations
     run: pnpm --filter @smart-acr/backend prisma migrate diff --from-migrations-directory prisma/migrations --to-schema-datamodel prisma/schema.prisma
   ```

3. **Mark destructive migrations**: Any migration that drops columns, tables, or alters data should be flagged in release notes and require explicit approval.

4. **Migration timeout**: Add `--timeout` to the migrate container to prevent indefinite hangs.

### 4.2 Rollback Strategy

**Current State:**
- `previous-release.env` tracks the prior image tag
- Rollback script pulls previous images and restarts
- Post-rollback smoke test runs

**Recommendations:**

1. **Maintain N-1 schema compatibility**: Design migrations so the previous version can still run against the new schema. Use expand-contract pattern:
   - Step 1 (deploy N): Add new column, keep old column
   - Step 2 (deploy N+1): Migrate data, drop old column

2. **Database rollback procedure**: Document how to restore from backup if schema rollback is needed. Add to the rollback script:
   ```bash
   if [[ "${RESTORE_DB}" == "true" ]]; then
     # find latest backup
     latest_db=$(ls -t "${BACKUP_DIR}"/smart-acr-db-*.sql.gz | head -1)
     latest_storage=$(ls -t "${BACKUP_DIR}"/smart-acr-storage-*.tar.gz | head -1)
     bash "${ROOT_DIR}/infra/scripts/restore-onprem.sh" "$latest_db" "$latest_storage"
   fi
   ```

3. **Keep 3 release versions** instead of just `current` and `previous` for deeper rollback history.

---

## 5. Backup/Recovery Recommendations

### 5.1 Current Backup Strategy

**Strengths:**
- `backup-onprem.sh` creates timestamped database + storage backups
- `restore-onprem.sh` restores both with clear usage
- `postgres-backup` service provides automated daily backups with 14-day/8-week/6-month retention
- `storage-backup` service archives file storage daily with 14-day retention
- Backups use Docker volumes for isolation

**Recommendations:**

1. **Backup verification**: Add integrity check after backup:
   ```bash
   # Verify backup is not empty and is valid gzip
   gzip -t "${db_backup_file}" || { echo "Backup verification failed"; exit 1; }
   backup_size=$(stat -f%z "${db_backup_file}" 2>/dev/null || stat -c%s "${db_backup_file}")
   if [[ "${backup_size}" -lt 1024 ]]; then
     echo "WARNING: Backup suspiciously small (${backup_size} bytes)"
     exit 1
   fi
   ```

2. **Off-site backup copy**: Add option to copy backups to a secondary location (network share, S3-compatible storage via MinIO).

3. **Backup monitoring**: Add Prometheus alert if automated backup container exits non-zero or no backup file is newer than 48 hours.

4. **Restore testing**: Schedule quarterly restore drills. Add `restore-test.sh` that restores to a temporary database and runs a basic query.

5. **Backup encryption**: Consider encrypting backups at rest, especially for a government ACR system handling personnel records.

---

## 6. Final Release-Readiness Assessment

### What's Production-Ready Now

| Area | Status | Notes |
|------|--------|-------|
| Container builds | Ready | Multi-stage, non-root, health checks |
| Reverse proxy | Ready | TLS, headers, rate limiting, internal network |
| Deploy automation | Ready | Scripted deploy with CI/CD workflow |
| Rollback mechanism | Ready | Image-level rollback with previous-release tracking |
| Backup/restore | Ready | Database + storage, daily automated |
| Monitoring | Ready | Prometheus + Loki + Grafana stack |
| Health checks | Ready | Liveness + readiness probes with dependency checks |
| Secret separation | Ready | Env files excluded from repo, GitHub secrets |
| Migration management | Ready | Prisma Migrate with deploy profile |
| Documentation | Ready | Deployment strategy, operations guide, release checklist |

### Pre-Production Blocklist (Must Fix)

1. **Add pre-deploy backup** in `deploy-onprem.sh` before migration step
2. **Protect `/api/v1/health/diagnostics`** with auth guard
3. **Add container resource limits** to production compose

### Recommended Before First Production Release

4. Add `npm audit` and Trivy scan to CI pipeline
5. Add log rotation to Docker compose
6. Tighten CSP to remove `unsafe-eval` from `script-src`
7. Add backup verification to `backup-onprem.sh`
8. Configure GitHub branch protection with required CI checks
9. Add deploy success/failure notifications

### Post-Launch Improvements

10. Implement expand-contract migration pattern for safer rollbacks
11. Add backup encryption for PHI/personnel data
12. Schedule quarterly restore drills
13. Pin Docker base images by digest
14. Add container read-only filesystem where possible

---

## Appendix: File Inventory

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI pipeline (lint, test, build, Docker) |
| `.github/workflows/release-onprem.yml` | Release pipeline (build, push, deploy) |
| `.github/workflows/rollback-onprem.yml` | Rollback pipeline |
| `backend/Dockerfile` | Backend multi-stage Docker build |
| `frontend/Dockerfile` | Frontend multi-stage Docker build |
| `infra/docker/docker-compose.onprem.yml` | Production compose stack |
| `infra/docker/docker-compose.staging.yml` | Staging overrides |
| `infra/docker/docker-compose.monitoring.yml` | Monitoring stack overlay |
| `infra/docker/docker-compose.yml` | Development compose stack |
| `infra/docker/nginx/nginx.conf` | Nginx main config |
| `infra/docker/nginx/conf.d/smart-acr.conf` | Nginx site config with TLS |
| `infra/scripts/deploy-onprem.sh` | Deploy script (bash) |
| `infra/scripts/deploy-onprem.ps1` | Deploy script (PowerShell) |
| `infra/scripts/rollback-onprem.sh` | Rollback script (bash) |
| `infra/scripts/rollback-onprem.ps1` | Rollback script (PowerShell) |
| `infra/scripts/backup-onprem.sh` | Manual backup script |
| `infra/scripts/restore-onprem.sh` | Restore from backup script |
| `infra/scripts/post-deploy-smoke.sh` | Post-deploy health verification |
| `docs/deployment/Release-Checklist.md` | Release checklist |
| `docs/deployment/OnPrem-Operations.md` | Operations guide |
| `docs/deployment/FIA-Smart-ACR-Deployment-Strategy.md` | Deployment strategy doc |
