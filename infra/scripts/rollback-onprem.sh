#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/infra/docker/docker-compose.onprem.yml}"
ROLLBACK_RELEASE_FILE="${ROLLBACK_RELEASE_FILE:-${ROOT_DIR}/infra/state/previous-release.env}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${ROOT_DIR}/infra/docker/env/backend.prod.env}"
FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-${ROOT_DIR}/infra/docker/env/frontend.prod.env}"

if [[ ! -f "${ROLLBACK_RELEASE_FILE}" ]]; then
  echo "Rollback release file not found: ${ROLLBACK_RELEASE_FILE}"
  exit 1
fi

if [[ ! -f "${BACKEND_ENV_FILE}" ]]; then
  echo "Missing backend env file: ${BACKEND_ENV_FILE}"
  exit 1
fi

if [[ ! -f "${FRONTEND_ENV_FILE}" ]]; then
  echo "Missing frontend env file: ${FRONTEND_ENV_FILE}"
  exit 1
fi

COMPOSE_ARGS=(--env-file "${ROLLBACK_RELEASE_FILE}" -f "${COMPOSE_FILE}")

pushd "${ROOT_DIR}" >/dev/null

docker compose "${COMPOSE_ARGS[@]}" pull backend frontend || true
docker compose "${COMPOSE_ARGS[@]}" up -d backend frontend reverse-proxy
bash "${ROOT_DIR}/infra/scripts/post-deploy-smoke.sh"

echo "Rollback completed successfully."

popd >/dev/null
