# Docker Deployment Assets

## Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Development stack (local dev) |
| `docker-compose.onprem.yml` | Production on-prem stack |
| `docker-compose.staging.yml` | Staging port overrides (layer on top of onprem) |
| `docker-compose.monitoring.yml` | Observability stack (layer on top of onprem) |

## Directory Layout

```
docker/
├── config/              # Env templates (committed to git)
│   ├── backend.prod.env.example
│   ├── frontend.prod.env.example
│   └── onprem.release.env.example
├── env/                 # Runtime env files (gitignored)
├── nginx/               # Reverse proxy configuration
├── certs/               # TLS certificates (gitignored, mount tls.crt + tls.key)
└── monitoring/          # Prometheus, Loki, Grafana, Promtail configs
    ├── prometheus.yml
    ├── loki.yml
    ├── promtail.yml
    ├── nginx-monitoring.conf
    └── grafana/
        └── provisioning/
            ├── datasources/
            └── dashboards/
```

## Quick Start (Production)

```bash
# 1. Copy and fill env files
cp config/backend.prod.env.example  env/backend.prod.env
cp config/frontend.prod.env.example  env/frontend.prod.env
cp config/onprem.release.env.example  env/onprem.release.env

# 2. Place TLS cert
cp your-cert.crt certs/tls.crt
cp your-key.key  certs/tls.key

# 3. Deploy
BUILD_IMAGES=true bash ../../infra/scripts/deploy-onprem.sh

# 4. Enable backups
docker compose --env-file env/onprem.release.env -f docker-compose.onprem.yml --profile backup up -d

# 5. Enable monitoring (optional)
docker compose --env-file env/onprem.release.env -f docker-compose.onprem.yml -f docker-compose.monitoring.yml up -d
```

## Profiles

| Profile | Services | Use |
|---------|----------|-----|
| `ops` | migrate, seed | One-shot migration/seed jobs |
| `backup` | postgres-backup, storage-backup | Automated daily backups |
| `cache` | redis | Redis cache (when needed) |
