#!/usr/bin/env bash

set -euo pipefail

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1/api/v1/health/ready}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1/}"
ATTEMPTS="${ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"

function wait_for_url() {
  local target_url="$1"
  local name="$2"
  local attempt=1

  while [[ "${attempt}" -le "${ATTEMPTS}" ]]; do
    if curl -fsS --max-time 5 "${target_url}" >/dev/null 2>&1; then
      echo "${name} health check passed (${target_url})"
      return 0
    fi

    echo "Waiting for ${name} (${attempt}/${ATTEMPTS})"
    sleep "${SLEEP_SECONDS}"
    attempt=$((attempt + 1))
  done

  echo "${name} health check failed (${target_url})"
  return 1
}

wait_for_url "${API_HEALTH_URL}" "API"
wait_for_url "${WEB_HEALTH_URL}" "Web"
