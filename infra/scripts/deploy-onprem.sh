#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/infra/docker/docker-compose.onprem.yml}"
RELEASE_ENV_FILE="${RELEASE_ENV_FILE:-${ROOT_DIR}/infra/docker/env/onprem.release.env}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${ROOT_DIR}/infra/docker/env/backend.prod.env}"
FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-${ROOT_DIR}/infra/docker/env/frontend.prod.env}"
STATE_FILE="${STATE_FILE:-${ROOT_DIR}/infra/state/current-release.env}"
RUN_DB_SEED="${RUN_DB_SEED:-false}"
BUILD_IMAGES="${BUILD_IMAGES:-false}"

if [[ ! -f "${RELEASE_ENV_FILE}" ]]; then
  echo "Missing release env file: ${RELEASE_ENV_FILE}"
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

COMPOSE_ARGS=(--env-file "${RELEASE_ENV_FILE}" -f "${COMPOSE_FILE}")

pushd "${ROOT_DIR}" >/dev/null

echo "Creating pre-deploy backup..."
RELEASE_ENV_FILE="${RELEASE_ENV_FILE}" \
BACKEND_ENV_FILE="${BACKEND_ENV_FILE}" \
bash "${ROOT_DIR}/infra/scripts/backup-onprem.sh" || {
  echo "WARNING: Pre-deploy backup failed. Continuing deployment..."
}

if [[ "${BUILD_IMAGES}" == "true" ]]; then
  docker compose "${COMPOSE_ARGS[@]}" build backend frontend
else
  docker compose "${COMPOSE_ARGS[@]}" pull backend frontend || true
fi

docker compose "${COMPOSE_ARGS[@]}" up -d postgres
docker compose "${COMPOSE_ARGS[@]}" --profile ops run --rm migrate

if [[ "${RUN_DB_SEED}" == "true" ]]; then
  docker compose "${COMPOSE_ARGS[@]}" --profile ops run --rm seed
fi

docker compose "${COMPOSE_ARGS[@]}" up -d backend frontend reverse-proxy

bash "${ROOT_DIR}/infra/scripts/post-deploy-smoke.sh"

mkdir -p "$(dirname "${STATE_FILE}")"
cp "${RELEASE_ENV_FILE}" "${STATE_FILE}"

echo "Deployment completed successfully."

popd >/dev/null
