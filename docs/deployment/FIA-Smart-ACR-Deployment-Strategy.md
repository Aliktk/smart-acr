# FIA Smart ACR Deployment Strategy

## 1. Recommended Deployment Model

**Recommendation: Docker Compose on FIA-managed on-prem Linux VM(s)**

Internal-only exposure through VPN + Nginx reverse proxy with TLS termination.

### Why This Is Best

- The application is a single product stack (Next.js + NestJS + PostgreSQL + local file storage) that does not require Kubernetes-level orchestration.
- Docker Compose is straightforward for FIA operations teams to run and support in controlled environments.
- Release and rollback are standardized with explicit image tags and scripted migration/deploy flow.
- The architecture remains fully cloud-portable because all services are containerized and storage/network contracts are explicit.
- Both bash and PowerShell deployment scripts are provided for Linux and Windows server environments.

### Alternative Options

| Option | When to Consider | Tradeoffs |
|--------|-----------------|-----------|
| **k3s / Kubernetes** | Multi-site active-active, dedicated platform ops team | Higher operational overhead, steeper learning curve |
| **Windows IIS + native services** | Docker/Linux not allowed by policy | Configuration drift, harder service management |

---

## 2. End-to-End Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FIA Internal Network                        │
│                                                                 │
│  ┌─────────┐         ┌──────────────────────────────────────┐   │
│  │   VPN   │────────>│         On-Prem Server(s)            │   │
│  │  Users  │         │                                      │   │
│  └─────────┘         │  ┌─────────────────────────────────┐ │   │
│                      │  │     edge network (:80/:443)     │ │   │
│                      │  │  ┌───────────────────────────┐  │ │   │
│                      │  │  │   Nginx Reverse Proxy     │  │ │   │
│                      │  │  │   TLS + Headers + Rate    │  │ │   │
│                      │  │  │   Limit + CSP             │  │ │   │
│                      │  │  └───────┬──────────┬────────┘  │ │   │
│                      │  └──────────┼──────────┼───────────┘ │   │
│                      │  ┌──────────┼──────────┼───────────┐ │   │
│                      │  │    internal network (isolated)  │ │   │
│                      │  │          │          │            │ │   │
│                      │  │    ┌─────▼───┐ ┌────▼────┐      │ │   │
│                      │  │    │ Backend │ │Frontend │      │ │   │
│                      │  │    │ NestJS  │ │ Next.js │      │ │   │
│                      │  │    │ :4000   │ │ :3000   │      │ │   │
│                      │  │    └────┬────┘ └─────────┘      │ │   │
│                      │  │         │                        │ │   │
│                      │  │    ┌────▼─────┐  ┌───────────┐  │ │   │
│                      │  │    │PostgreSQL│  │  Storage   │  │ │   │
│                      │  │    │  :5432   │  │  Volume    │  │ │   │
│                      │  │    └──────────┘  └───────────┘  │ │   │
│                      │  │                                  │ │   │
│                      │  │  ┌────────────────────────────┐  │ │   │
│                      │  │  │  Monitoring (optional)     │  │ │   │
│                      │  │  │  Prometheus + Loki +       │  │ │   │
│                      │  │  │  Grafana + Promtail        │  │ │   │
│                      │  │  └────────────────────────────┘  │ │   │
│                      │  │                                  │ │   │
│                      │  │  ┌────────────────────────────┐  │ │   │
│                      │  │  │  Backup (profile: backup)  │  │ │   │
│                      │  │  │  DB daily + Storage daily  │  │ │   │
│                      │  │  └────────────────────────────┘  │ │   │
│                      │  └──────────────────────────────────┘ │   │
│                      └──────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

| Component | Technology | Container | Port | Notes |
|-----------|-----------|-----------|------|-------|
| Frontend | Next.js 15 (standalone) | `smart-acr-frontend` | 3000 | Non-root, health checked |
| Backend | NestJS 11 | `smart-acr-backend` | 4000 | Non-root, health checked, metrics |
| Database | PostgreSQL 16 | `smart-acr-postgres` | 5432 | Persistent volume, health checked |
| Reverse Proxy | Nginx 1.27 | `smart-acr-proxy` | 80/443 | TLS, security headers, rate limit |
| DB Backup | postgres-backup-local | `smart-acr-postgres-backup` | - | Daily, 14d/8w/6m retention |
| Storage Backup | Alpine cron | `smart-acr-storage-backup` | - | Daily tar.gz, 14d retention |
| Prometheus | prom/prometheus | `smart-acr-prometheus` | 9090 | 30d retention |
| Loki | grafana/loki | `smart-acr-loki` | 3100 | 30d retention |
| Promtail | grafana/promtail | `smart-acr-promtail` | - | Docker log shipping |
| Grafana | grafana/grafana | `smart-acr-grafana` | 3000 | Provisioned datasources + dashboards |

### Networking

- **`internal` network**: Isolated Docker network (`internal: true`). All app/data services communicate here. Not reachable from outside Docker.
- **`edge` network**: Only the reverse proxy joins this network. It is the only service publishing ports to the host.
- **No service exposes ports directly** except the reverse proxy (80/443).

### Storage

- **Database**: PostgreSQL persistent volume (`pg_data`)
- **File uploads** (signatures, stamps, PDFs): Persistent volume (`acr_storage`) mounted at `/var/lib/smart-acr/storage`
- **Backups**: Separate volumes (`pg_backups`, `storage_backups`) for automated daily backups

---

## 3. CI/CD Strategy

### Branch Strategy

```
feature/* ──PR──> develop ──merge──> main
                     │                  │
                     ▼                  ▼
              staging release    production release
              (auto or manual)    (manual dispatch)
```

### CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push/PR to `main` or `develop`:

1. **Install** - `pnpm install --frozen-lockfile`
2. **Lint** - `pnpm lint`
3. **Typecheck** - `pnpm typecheck`
4. **Test** - `pnpm test`
5. **Build** - `pnpm build`
6. **Container build validation** - Builds both Dockerfiles (no push)

### CD Pipeline (`.github/workflows/release-onprem.yml`)

Manual dispatch with environment selection (`staging` / `production`):

1. **Build & push** images to GHCR with explicit tag (git SHA or custom)
2. **Deploy job** runs on **self-hosted runner** inside FIA network:
   - Pull images
   - Run database migrations (`prisma migrate deploy`)
   - Optionally run seed
   - Start services
   - Run smoke tests (health + web checks)
   - Save release state for rollback

### Rollback Pipeline (`.github/workflows/rollback-onprem.yml`)

Manual dispatch:
1. Reads `infra/state/previous-release.env` for last known good image tags
2. Pulls previous images
3. Restarts services (no destructive migration steps)
4. Runs smoke tests

### Required CI/CD Secrets

| Secret | Purpose |
|--------|---------|
| `BACKEND_ENV_PRODUCTION` | Full backend.prod.env content for production |
| `FRONTEND_ENV_PRODUCTION` | Full frontend.prod.env content for production |
| `BACKEND_ENV_STAGING` | Backend env content for staging |
| `FRONTEND_ENV_STAGING` | Frontend env content for staging |

### Environment Protection

- Use **GitHub Environments** with required reviewers for production deployments
- Environment-scoped secrets prevent staging secrets from leaking to production

---

## 4. On-Prem Deployment Plan

### Server Sizing (Recommended Baseline)

| Role | Specs | Services |
|------|-------|----------|
| App Node | 8 vCPU, 16+ GB RAM, 100 GB SSD | Frontend, Backend, Proxy, Monitoring |
| DB Node (optional separate) | 8 vCPU, 32+ GB RAM, fast SSD | PostgreSQL, Backups |

For small deployments, a single server with 16+ GB RAM is sufficient.

### Prerequisites

1. Linux host (Ubuntu 22.04+ or RHEL 8+) with Docker Engine 24+ and Docker Compose v2
2. TLS certificate and key for internal hostname
3. VPN connectivity configured
4. Firewall rules allowing VPN CIDRs to reach port 443

### Environment Setup

```bash
# 1. Copy env templates
cp infra/docker/config/backend.prod.env.example  infra/docker/env/backend.prod.env
cp infra/docker/config/frontend.prod.env.example  infra/docker/env/frontend.prod.env
cp infra/docker/config/onprem.release.env.example  infra/docker/env/onprem.release.env

# 2. Edit with production values
# - Strong database password
# - 64-char random JWT secrets
# - Correct WEB_ORIGIN (e.g., https://acr.fia.gov.pk)
# - Image tags

# 3. Place TLS cert
cp your-cert.crt infra/docker/certs/tls.crt
cp your-key.key  infra/docker/certs/tls.key
```

### VPN Access Model

```
FIA User → VPN Client → FIA VPN Gateway → Internal DNS (acr.fia.gov.pk)
                                                    ↓
                                          App Server :443 (Nginx)
```

- Application is **never exposed to public internet**
- Internal DNS resolves `acr.fia.gov.pk` to the app server's internal IP
- Firewall allowlists only VPN subnet CIDRs to reach port 443
- Port 80 redirects to 443 only

### Service Layout

```
infra/docker/
├── docker-compose.onprem.yml          # Production stack
├── docker-compose.staging.yml          # Staging port overrides
├── docker-compose.monitoring.yml       # Observability stack (optional)
├── docker-compose.yml                  # Development stack
├── env/                                # Runtime env files (gitignored)
│   ├── backend.prod.env
│   ├── frontend.prod.env
│   └── onprem.release.env
├── config/                             # Env templates (committed)
│   ├── backend.prod.env.example
│   ├── frontend.prod.env.example
│   └── onprem.release.env.example
├── nginx/                              # Proxy configuration
├── certs/                              # TLS certificates (gitignored)
└── monitoring/                         # Prometheus, Loki, Grafana config
```

---

## 5. Cloud-Ready Future Path

### What Is Already Portable

- Containerized frontend and backend with multi-stage Dockerfiles
- Explicit reverse proxy ingress model
- Environment-based configuration (12-factor)
- Scriptable migrations and rollout logic
- Health check endpoints for managed orchestrators

### Migration Path

| Component | On-Prem | AWS | Azure |
|-----------|---------|-----|-------|
| Frontend | Docker container | ECS/Fargate or Amplify | Azure Container Apps |
| Backend | Docker container | ECS/Fargate | Azure Container Apps |
| Database | PostgreSQL container | RDS PostgreSQL | Azure DB for PostgreSQL |
| Storage | Local volume | S3 | Azure Blob Storage |
| Proxy | Nginx container | ALB + ACM | Azure Front Door |
| TLS | Self-managed cert | ACM (auto-renewal) | Azure managed certs |
| CI/CD | GitHub Actions + self-hosted runner | GitHub Actions + OIDC | Same |
| Monitoring | Prometheus + Grafana | CloudWatch / managed Grafana | Azure Monitor |

### What Changes for Cloud

1. **Storage adapter**: Replace `STORAGE_PATH` local filesystem with S3/Blob SDK calls in `files.service.ts`
2. **Database**: Point `DATABASE_URL` to managed PostgreSQL instance
3. **Proxy**: Replace Nginx container with managed load balancer + cert manager
4. **Secrets**: Move from env files to AWS Secrets Manager / Azure Key Vault
5. **CI/CD target**: Change deploy step from self-hosted runner to cloud deploy action

### What Stays the Same

- Application code contracts and API topology
- Migration and release discipline
- Docker images (same images deploy anywhere)
- Health check endpoints
- Monitoring metrics format (Prometheus-compatible)

---

## 6. Scaling, Security, and Reliability

### Scaling Strategy

| Layer | Approach | Command |
|-------|----------|---------|
| Frontend | Horizontal (add replicas) | `docker compose ... up -d --scale frontend=2` |
| Backend | Horizontal (add replicas) | `docker compose ... up -d --scale backend=2` |
| Database | Vertical first, read replicas later | Increase VM CPU/RAM/IOPS |
| Storage | Migrate to S3-compatible when volume exceeds capacity | MinIO or cloud object storage |

- **Session/auth**: JWT + refresh token flow is stateless; works with multiple backend replicas without session affinity.
- **Nginx**: Docker DNS resolver (`127.0.0.11`) enables automatic round-robin across scaled replicas. `proxy_next_upstream` provides failover.

### Security Hardening

| Control | Implementation |
|---------|---------------|
| TLS termination | Nginx with TLSv1.2+1.3, strong cipher suite |
| Security headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy |
| Rate limiting | 15 req/s per IP on API with burst=30 |
| Non-root containers | All services run as UID 1001 |
| Privilege escalation | `no-new-privileges:true` on all containers |
| Network isolation | `internal: true` network for app/data services |
| No public exposure | VPN + firewall only |
| Secret management | Env files gitignored, CI secrets for automated deploys |
| Image tags | Explicit SHA-tagged releases, no `:latest` in production |
| Input validation | NestJS ValidationPipe with whitelist + forbidNonWhitelisted |
| CORS | Restricted to configured `WEB_ORIGIN` |

### Backup and Recovery

| Target | Schedule | Retention | Location |
|--------|----------|-----------|----------|
| PostgreSQL | Daily at midnight | 14 days + 8 weeks + 6 months | `pg_backups` volume |
| File storage | Daily at 02:00 | 14 days | `storage_backups` volume |
| Ad-hoc backup | Manual | As needed | `infra/backups/` directory |

**Restore procedure:**
```bash
bash infra/scripts/restore-onprem.sh <db-backup.sql.gz> <storage-backup.tar.gz>
```

### Observability

| Layer | Tool | Details |
|-------|------|---------|
| Application metrics | Prometheus | HTTP request rate, latency histograms, error rate, auth tokens |
| Application logs | Loki + Promtail | Docker container logs, structured JSON |
| Health checks | Built-in | `/api/v1/health` (liveness), `/api/v1/health/ready` (readiness) |
| Metrics endpoint | Built-in | `/api/v1/metrics` (Prometheus text format) |
| Dashboards | Grafana | Pre-provisioned Smart ACR Overview dashboard |
| Nginx metrics | stub_status | Request counts, active connections |
| Alerting | Grafana alerts | Configure thresholds for error rate, latency, health failures |

---

## 7. Implementation Files

### Containerization
- `backend/Dockerfile` - Multi-stage NestJS build, non-root, health check
- `frontend/Dockerfile` - Multi-stage Next.js standalone build, non-root, health check
- `frontend/next.config.mjs` - Standalone output mode
- `.dockerignore` - Excludes node_modules, .git, tests, docs

### Health and Metrics
- `backend/src/modules/health/health.controller.ts` - `/health` and `/health/ready`
- `backend/src/modules/health/metrics.controller.ts` - `/metrics` (Prometheus format)
- `backend/src/common/metrics.middleware.ts` - Request counting and latency histograms
- `backend/src/modules/health/health.module.ts` - Registers middleware globally

### On-Prem Stack
- `infra/docker/docker-compose.onprem.yml` - Production stack with health checks, security, backup services
- `infra/docker/docker-compose.staging.yml` - Staging port overrides
- `infra/docker/docker-compose.monitoring.yml` - Prometheus + Loki + Grafana stack
- `infra/docker/nginx/nginx.conf` - Main Nginx config with rate limiting
- `infra/docker/nginx/conf.d/smart-acr.conf` - Server blocks with TLS, CSP, scaling support
- `infra/docker/certs/.gitkeep` - TLS certificate mount point
- `infra/docker/env/.gitkeep` - Runtime env directory

### Monitoring Config
- `infra/docker/monitoring/prometheus.yml` - Scrape config for backend + Nginx
- `infra/docker/monitoring/loki.yml` - Log storage config with 30d retention
- `infra/docker/monitoring/promtail.yml` - Docker log scraping
- `infra/docker/monitoring/nginx-monitoring.conf` - Grafana reverse proxy path
- `infra/docker/monitoring/grafana/provisioning/datasources/datasources.yml`
- `infra/docker/monitoring/grafana/provisioning/dashboards/dashboards.yml`
- `infra/docker/monitoring/grafana/provisioning/dashboards/json/smart-acr-overview.json`

### Environment Templates
- `infra/docker/config/backend.prod.env.example`
- `infra/docker/config/frontend.prod.env.example`
- `infra/docker/config/onprem.release.env.example`

### CI/CD
- `.github/workflows/ci.yml` - PR/push validation pipeline
- `.github/workflows/release-onprem.yml` - Build, push, deploy via self-hosted runner
- `.github/workflows/rollback-onprem.yml` - Rollback to previous release

### Operations Scripts
- `infra/scripts/deploy-onprem.sh` - Linux deploy
- `infra/scripts/deploy-onprem.ps1` - Windows PowerShell deploy
- `infra/scripts/rollback-onprem.sh` - Linux rollback
- `infra/scripts/rollback-onprem.ps1` - Windows PowerShell rollback
- `infra/scripts/backup-onprem.sh` - Ad-hoc backup (DB + storage)
- `infra/scripts/restore-onprem.sh` - Restore from backup files
- `infra/scripts/post-deploy-smoke.sh` - Health check verification
- `infra/scripts/post-deploy-smoke.ps1` - Windows health check verification

### State
- `infra/state/.gitkeep` - Release state tracking directory

---

## 8. Step-by-Step Runbook

### Initial Deployment

1. **Provision infrastructure**
   ```bash
   # Install Docker Engine + Compose v2 on Linux host
   # Configure firewall: allow VPN CIDRs to port 80/443
   # Configure internal DNS: acr.fia.gov.pk -> server IP
   ```

2. **Clone and configure**
   ```bash
   git clone <repo-url> /opt/smart-acr
   cd /opt/smart-acr

   # Copy env templates
   cp infra/docker/config/backend.prod.env.example  infra/docker/env/backend.prod.env
   cp infra/docker/config/frontend.prod.env.example  infra/docker/env/frontend.prod.env
   cp infra/docker/config/onprem.release.env.example  infra/docker/env/onprem.release.env

   # Edit env files with production values (strong passwords, JWT secrets, WEB_ORIGIN)
   ```

3. **Install TLS certificate**
   ```bash
   cp /path/to/tls.crt infra/docker/certs/tls.crt
   cp /path/to/tls.key infra/docker/certs/tls.key
   chmod 600 infra/docker/certs/tls.key
   ```

4. **Deploy**
   ```bash
   # Build locally (if not using registry)
   BUILD_IMAGES=true bash infra/scripts/deploy-onprem.sh

   # Or pull from GHCR (after CI release)
   bash infra/scripts/deploy-onprem.sh
   ```

   Windows PowerShell:
   ```powershell
   .\infra\scripts\deploy-onprem.ps1 -BuildImages
   ```

5. **Enable automated backups**
   ```bash
   docker compose --env-file infra/docker/env/onprem.release.env \
     -f infra/docker/docker-compose.onprem.yml \
     --profile backup up -d
   ```

6. **Enable monitoring (optional)**
   ```bash
   docker compose --env-file infra/docker/env/onprem.release.env \
     -f infra/docker/docker-compose.onprem.yml \
     -f infra/docker/docker-compose.monitoring.yml \
     up -d
   ```

7. **Validate** (see checklist below)

### Update Deployment

1. Update image tag in `infra/docker/env/onprem.release.env` (or use CI release workflow)
2. Run deployment script:
   ```bash
   bash infra/scripts/deploy-onprem.sh
   ```
3. Smoke tests run automatically
4. Review backend logs for errors:
   ```bash
   docker compose --env-file infra/docker/env/onprem.release.env \
     -f infra/docker/docker-compose.onprem.yml logs -f backend --since 5m
   ```

### Restart Services

```bash
# Restart specific service
docker compose --env-file infra/docker/env/onprem.release.env \
  -f infra/docker/docker-compose.onprem.yml restart backend

# Stop entire stack
docker compose --env-file infra/docker/env/onprem.release.env \
  -f infra/docker/docker-compose.onprem.yml down

# Start entire stack
docker compose --env-file infra/docker/env/onprem.release.env \
  -f infra/docker/docker-compose.onprem.yml up -d
```

### Rollback

1. Ensure `infra/state/previous-release.env` has last known good image tags
2. Execute:
   ```bash
   bash infra/scripts/rollback-onprem.sh
   ```
   Windows:
   ```powershell
   .\infra\scripts\rollback-onprem.ps1
   ```
3. Validate health and critical user journeys

### Backup

```bash
# Ad-hoc backup
bash infra/scripts/backup-onprem.sh

# Move backups to secure secondary storage
cp infra/backups/smart-acr-db-*.sql.gz /mnt/backup-drive/
cp infra/backups/smart-acr-storage-*.tar.gz /mnt/backup-drive/
```

### Restore

```bash
bash infra/scripts/restore-onprem.sh \
  infra/backups/smart-acr-db-20260409-020000.sql.gz \
  infra/backups/smart-acr-storage-20260409-020000.tar.gz

# Then redeploy services
bash infra/scripts/deploy-onprem.sh
```

### Post-Deploy Validation Checklist

- [ ] `https://acr.fia.gov.pk/` loads login page
- [ ] `https://acr.fia.gov.pk/api/v1/health/ready` returns `{"ok":true}`
- [ ] Login with valid credentials succeeds
- [ ] Token refresh works (stay logged in beyond access token TTL)
- [ ] ACR create/edit/transition works for Clerk, Reporting Officer, Countersigning Officer, Secret Branch roles
- [ ] File upload (signature/stamp) works in settings and ACR forms
- [ ] File download/view works for uploaded PDFs
- [ ] Audit log entries appear for actions performed
- [ ] `https://acr.fia.gov.pk/api/v1/metrics` returns Prometheus metrics (if monitoring enabled)
- [ ] Grafana dashboard at `/grafana/` shows data (if monitoring enabled)
- [ ] Database migration state is current (`prisma migrate status`)
