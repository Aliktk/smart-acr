# Release Checklist (On-Prem)

## Pre-Release

- [ ] Backup completed in last 24 hours (database + storage volume)
- [ ] `backend.prod.env` and `frontend.prod.env` updated and validated
- [ ] TLS certificate/key validity checked
- [ ] CI pipeline (`ci.yml`) passed on target commit
- [ ] Migration SQL reviewed for destructive operations
- [ ] Release notes prepared with summary of changes

## Release Execution

- [ ] Run `release-onprem.yml` (recommended) or `infra/scripts/deploy-onprem.sh`
- [ ] Migration step finished successfully
- [ ] `backend`, `frontend`, and `reverse-proxy` containers are healthy

## Post-Release Validation

- [ ] `GET /api/v1/health/ready` returns `{"ok":true}`
- [ ] Login + token refresh workflow works
- [ ] ACR create, transition, archive path works for at least one test record
- [ ] Signature/stamp reusable asset flow works in settings and in-form dual upload
- [ ] File upload/download works (PDF, images)
- [ ] Audit logs and notifications continue to populate
- [ ] Grafana dashboard shows healthy metrics (if monitoring enabled)
- [ ] No elevated error rate in logs

## Rollback Trigger Conditions

- Health endpoint unhealthy for 5+ minutes after deployment
- Blocking regression in workflow transitions or authentication
- File upload/download regression impacting production operations
- Unacceptable latency or crash loops after scaling
- Database migration failure that cannot be resolved quickly

## Rollback Action

1. Run `rollback-onprem.yml` or `infra/scripts/rollback-onprem.sh`
2. Validate health and critical user journey
3. Open incident and mark bad release tag for follow-up
4. If database migration was destructive, restore from pre-release backup
