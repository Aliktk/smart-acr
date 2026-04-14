#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/infra/docker/docker-compose.onprem.yml}"
RELEASE_ENV_FILE="${RELEASE_ENV_FILE:-${ROOT_DIR}/infra/docker/env/onprem.release.env}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${ROOT_DIR}/infra/docker/env/backend.prod.env}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/infra/backups}"

mkdir -p "${BACKUP_DIR}"

timestamp="$(date +%Y%m%d-%H%M%S)"
db_backup_file="${BACKUP_DIR}/smart-acr-db-${timestamp}.sql.gz"
storage_backup_file="${BACKUP_DIR}/smart-acr-storage-${timestamp}.tar.gz"

set -a
source "${BACKEND_ENV_FILE}"
set +a

COMPOSE_ARGS=(--env-file "${RELEASE_ENV_FILE}" -f "${COMPOSE_FILE}")

pushd "${ROOT_DIR}" >/dev/null

docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${db_backup_file}"

docker run --rm \
  -v smart-acr_acr_storage:/data:ro \
  -v "${BACKUP_DIR}:/backup" \
  alpine:3.20 \
  sh -c "tar -czf /backup/$(basename "${storage_backup_file}") -C /data ."

echo "Verifying backups..."

gzip -t "${db_backup_file}" || { echo "ERROR: Database backup verification failed"; exit 1; }
db_size=$(stat -c%s "${db_backup_file}" 2>/dev/null || stat -f%z "${db_backup_file}" 2>/dev/null || echo "0")
if [[ "${db_size}" -lt 1024 ]]; then
  echo "WARNING: Database backup suspiciously small (${db_size} bytes)"
fi

gzip -t "${storage_backup_file}" || { echo "ERROR: Storage backup verification failed"; exit 1; }

echo "Database backup: ${db_backup_file} (${db_size} bytes)"
echo "Storage backup: ${storage_backup_file}"
echo "Backup verification passed."

popd >/dev/null
