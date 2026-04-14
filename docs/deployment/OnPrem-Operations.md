# On-Prem Operations Guide

## Common Variables

All compose commands require the release env file. Set a shell alias for convenience:

```bash
alias sacr='docker compose --env-file infra/docker/env/onprem.release.env -f infra/docker/docker-compose.onprem.yml'
```

## Service Control

Start or update stack:
```bash
bash infra/scripts/deploy-onprem.sh
```
PowerShell:
```powershell
.\infra\scripts\deploy-onprem.ps1
```

Stop stack:
```bash
sacr down
```

Restart single service:
```bash
sacr restart backend
```

View running services:
```bash
sacr ps
```

## Migrations

Run migrations only (no service restart):
```bash
sacr --profile ops run --rm migrate
```

## Seed (Optional)

```bash
sacr --profile ops run --rm seed
```

## Scaling

Scale backend horizontally:
```bash
sacr up -d --scale backend=2
```

Scale frontend horizontally:
```bash
sacr up -d --scale frontend=2
```

Scale PostgreSQL vertically (CPU/RAM/IOPS) before adding clustering.

## Automated Backups

Enable backup services (daily DB + daily storage):
```bash
sacr --profile backup up -d
```

Check backup service status:
```bash
sacr ps postgres-backup storage-backup
```

## Ad-Hoc Backup

```bash
bash infra/scripts/backup-onprem.sh
```

## Restore from Backup

```bash
bash infra/scripts/restore-onprem.sh <db-backup.sql.gz> <storage-backup.tar.gz>
```

Then redeploy services:
```bash
bash infra/scripts/deploy-onprem.sh
```

## Monitoring Stack

Enable monitoring (Prometheus + Loki + Grafana):
```bash
docker compose --env-file infra/docker/env/onprem.release.env \
  -f infra/docker/docker-compose.onprem.yml \
  -f infra/docker/docker-compose.monitoring.yml \
  up -d
```

Access Grafana at `https://<host>/grafana/` (default admin/change-me-grafana).

Check monitoring services:
```bash
docker compose --env-file infra/docker/env/onprem.release.env \
  -f infra/docker/docker-compose.onprem.yml \
  -f infra/docker/docker-compose.monitoring.yml \
  ps prometheus loki grafana promtail
```

## Logs and Diagnostics

Backend logs:
```bash
sacr logs -f backend
```

Frontend logs:
```bash
sacr logs -f frontend
```

Proxy logs:
```bash
sacr logs -f reverse-proxy
```

All service logs (last 100 lines):
```bash
sacr logs --tail 100
```

Backend logs since last deploy:
```bash
sacr logs -f backend --since 5m
```

## Health Checks

API health (liveness):
```bash
curl -k https://127.0.0.1/api/v1/health
```

API readiness (DB + storage):
```bash
curl -k https://127.0.0.1/api/v1/health/ready
```

Prometheus metrics:
```bash
curl -k https://127.0.0.1/api/v1/metrics
```

## Troubleshooting

Container keeps restarting:
```bash
sacr logs backend --tail 50
docker inspect smart-acr-backend --format '{{.State.ExitCode}}'
```

Database connection issues:
```bash
sacr exec postgres pg_isready -U smartacr -d smart_acr
```

Check disk usage:
```bash
docker system df
docker volume ls --format '{{.Name}}\t{{.Driver}}'
```

Prune unused images (after successful deploy):
```bash
docker image prune -f
```
