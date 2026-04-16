#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-gcp.sh
# One-step deployment for GCP VM (HTTP, testing mode).
# Run from the REPO ROOT: bash infra/scripts/deploy-gcp.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/infra/docker/docker-compose.gcp.yml"
BACKEND_ENV="${ROOT_DIR}/infra/docker/env/backend.gcp.env"
FRONTEND_ENV="${ROOT_DIR}/infra/docker/env/frontend.gcp.env"
RUN_SEED="${RUN_SEED:-false}"

# ── Pre-flight checks ─────────────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Run: bash infra/scripts/setup-gcp-vm.sh"
  exit 1
fi

if [[ ! -f "${BACKEND_ENV}" ]]; then
  echo "ERROR: Missing ${BACKEND_ENV}"
  echo "       Copy infra/docker/config/backend.gcp.env.example to that path"
  echo "       and fill in all CHANGE_ME values."
  exit 1
fi

if [[ ! -f "${FRONTEND_ENV}" ]]; then
  echo "ERROR: Missing ${FRONTEND_ENV}"
  echo "       Copy infra/docker/config/frontend.gcp.env.example to that path."
  exit 1
fi

# Sanity-check: reject placeholder secrets
if grep -q "CHANGE_ME" "${BACKEND_ENV}"; then
  echo "ERROR: backend.gcp.env still contains CHANGE_ME placeholder values."
  echo "       Fill in all secrets before deploying."
  exit 1
fi

cd "${ROOT_DIR}"

echo "==> Building Docker images (this takes 5-10 minutes on first run)..."
docker compose -f "${COMPOSE_FILE}" build backend frontend

echo "==> Starting PostgreSQL..."
docker compose -f "${COMPOSE_FILE}" up -d postgres

echo "==> Waiting for database to be ready..."
sleep 5

echo "==> Running database migrations..."
docker compose -f "${COMPOSE_FILE}" --profile ops run --rm migrate

if [[ "${RUN_SEED}" == "true" ]]; then
  echo "==> Seeding database with default data..."
  docker compose -f "${COMPOSE_FILE}" --profile ops run --rm seed
fi

echo "==> Starting all services..."
docker compose -f "${COMPOSE_FILE}" up -d backend frontend reverse-proxy

echo "==> Waiting for services to become healthy (up to 3 minutes)..."
WAIT=0
MAX_WAIT=180
until docker compose -f "${COMPOSE_FILE}" ps | grep -q "healthy" || [[ "${WAIT}" -ge "${MAX_WAIT}" ]]; do
  printf "."
  sleep 5
  WAIT=$((WAIT + 5))
done
echo ""

echo "==> Running smoke tests..."
API_OK=false
WEB_OK=false

for i in $(seq 1 12); do
  if curl -fsS --max-time 5 "http://127.0.0.1/api/v1/health/ready" >/dev/null 2>&1; then
    API_OK=true
    break
  fi
  echo "  Waiting for API (${i}/12)..."
  sleep 5
done

for i in $(seq 1 12); do
  if curl -fsS --max-time 5 "http://127.0.0.1/" >/dev/null 2>&1; then
    WEB_OK=true
    break
  fi
  echo "  Waiting for Web (${i}/12)..."
  sleep 5
done

echo ""
echo "======================================================"
if [[ "${API_OK}" == "true" ]] && [[ "${WEB_OK}" == "true" ]]; then
  echo "  Deployment SUCCESSFUL!"
  echo ""
  echo "  Application URL: http://34.44.76.159"
  echo "  API health:      http://34.44.76.159/api/v1/health/ready"
  echo "======================================================"
else
  echo "  WARNING: Smoke tests did not all pass."
  [[ "${API_OK}" != "true" ]] && echo "  API health check FAILED"
  [[ "${WEB_OK}" != "true" ]] && echo "  Web health check FAILED"
  echo ""
  echo "  Check logs with: docker compose -f infra/docker/docker-compose.gcp.yml logs -f"
  echo "======================================================"
  exit 1
fi
