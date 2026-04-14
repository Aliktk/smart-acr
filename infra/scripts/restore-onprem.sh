#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <db-backup.sql.gz> <storage-backup.tar.gz>"
  exit 1
fi

DB_BACKUP_FILE="$1"
STORAGE_BACKUP_FILE="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/infra/docker/docker-compose.onprem.yml}"
RELEASE_ENV_FILE="${RELEASE_ENV_FILE:-${ROOT_DIR}/infra/docker/env/onprem.release.env}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${ROOT_DIR}/infra/docker/env/backend.prod.env}"

if [[ ! -f "${DB_BACKUP_FILE}" ]]; then
  echo "Database backup not found: ${DB_BACKUP_FILE}"
  exit 1
fi

if [[ ! -f "${STORAGE_BACKUP_FILE}" ]]; then
  echo "Storage backup not found: ${STORAGE_BACKUP_FILE}"
  exit 1
fi

set -a
source "${BACKEND_ENV_FILE}"
set +a

COMPOSE_ARGS=(--env-file "${RELEASE_ENV_FILE}" -f "${COMPOSE_FILE}")

pushd "${ROOT_DIR}" >/dev/null

docker compose "${COMPOSE_ARGS[@]}" up -d postgres
gunzip -c "${DB_BACKUP_FILE}" | docker compose "${COMPOSE_ARGS[@]}" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

docker run --rm \
  -v smart-acr_acr_storage:/data \
  -v "$(dirname "${STORAGE_BACKUP_FILE}"):/backup:ro" \
  alpine:3.20 \
  sh -c "rm -rf /data/* && tar -xzf /backup/$(basename "${STORAGE_BACKUP_FILE}") -C /data"

echo "Restore completed. Run deployment script to re-apply services."

popd >/dev/null
