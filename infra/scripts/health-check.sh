#!/usr/bin/env bash
# =============================================================================
# Smart ACR — Multi-Environment Health Check
# =============================================================================
# Usage:
#   ./infra/scripts/health-check.sh [--env ENV] [--all] [--json] [--help]
#
# Examples:
#   ./infra/scripts/health-check.sh                  # checks all configured envs
#   ./infra/scripts/health-check.sh --env onprem     # on-prem GCP VM only
#   ./infra/scripts/health-check.sh --env local      # local Docker
#   ./infra/scripts/health-check.sh --env gcp        # GCP cloud instance
#   ./infra/scripts/health-check.sh --json           # machine-readable JSON output
#   ./infra/scripts/health-check.sh --env onprem --live-logs  # tail container logs
# =============================================================================

set -euo pipefail

# ── Resolve script and project root ──────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENVS_DIR="${PROJECT_ROOT}/infra/config/envs"

# ── Colour palette ────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
  TICK="✔"; CROSS="✘"; WARN="⚠"; ARROW="→"
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; DIM=''; RESET=''
  TICK="OK"; CROSS="FAIL"; WARN="WARN"; ARROW="->"
fi

# ── Argument parsing ──────────────────────────────────────────────────────────
TARGET_ENV=""
OUTPUT_JSON=false
LIVE_LOGS=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --env <name>   Check a specific environment (matches filename in infra/config/envs/)
  --all          Check all configured environments (default when no --env given)
  --json         Output machine-readable JSON instead of coloured text
  --live-logs    After health check, tail container logs (remote or local)
  -h, --help     Show this help

Available environments:
$(ls "${ENVS_DIR}"/*.conf 2>/dev/null | xargs -I{} basename {} .conf | sed 's/^/  /')
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)      TARGET_ENV="$2"; shift 2 ;;
    --all)      TARGET_ENV=""; shift ;;
    --json)     OUTPUT_JSON=true; shift ;;
    --live-logs) LIVE_LOGS=true; shift ;;
    -h|--help)  usage; exit 0 ;;
    *)          echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
timestamp() { date "+%Y-%m-%d %H:%M:%S %Z"; }

pass()  { echo -e "${GREEN}  ${TICK} ${RESET}$*"; }
fail()  { echo -e "${RED}  ${CROSS} ${RESET}$*"; }
warn()  { echo -e "${YELLOW}  ${WARN} ${RESET}$*"; }
info()  { echo -e "${DIM}  ${ARROW} ${RESET}$*"; }

section() {
  echo ""
  echo -e "${CYAN}${BOLD}  ── $* ──${RESET}"
}

divider() {
  echo -e "${DIM}  ─────────────────────────────────────────────────────${RESET}"
}

# ── Remote execution helper ───────────────────────────────────────────────────
# Runs a command on the remote host (or locally) and returns its output.
run_cmd() {
  local env_type="$1"; shift
  local ssh_host="$1"; shift
  local ssh_user="$1"; shift
  local ssh_key="$1"; shift
  local ssh_port="$1"; shift

  if [[ "${env_type}" == "remote" ]]; then
    local ssh_opts="-o StrictHostKeyChecking=no -o ConnectTimeout=8 -o BatchMode=yes"
    [[ -n "${ssh_key}" ]] && ssh_opts="${ssh_opts} -i ${ssh_key}"
    ssh ${ssh_opts} -p "${ssh_port:-22}" "${ssh_user}@${ssh_host}" "$@" 2>&1
  else
    bash -c "$*" 2>&1
  fi
}

# ── JSON accumulator ──────────────────────────────────────────────────────────
JSON_OUTPUT="[]"

append_json() {
  local env_json="$1"
  JSON_OUTPUT=$(echo "${JSON_OUTPUT}" | \
    python3 -c "import sys,json; arr=json.load(sys.stdin); arr.append(json.loads('''${env_json}''')); print(json.dumps(arr,indent=2))" 2>/dev/null \
    || echo "${JSON_OUTPUT}")
}

# ── Core health-check logic (runs on target machine) ─────────────────────────
# This is the actual probe logic, emitted as a heredoc and executed locally or
# forwarded via SSH to the remote machine.
build_probe_script() {
  local app_dir="$1"
  local compose_file="$2"
  local containers="$3"
  local postgres_container="$4"
  local postgres_user="$5"
  local public_url="$6"
  local api_health_path="$7"
  local nginx_health_path="$8"

  cat <<PROBE
#!/usr/bin/env bash
set -uo pipefail

APP_DIR="${app_dir}"
COMPOSE_FILE="${compose_file}"
CONTAINERS="${containers}"
POSTGRES_CONTAINER="${postgres_container}"
POSTGRES_USER="${postgres_user}"
PUBLIC_URL="${public_url}"
API_HEALTH_PATH="${api_health_path}"
NGINX_HEALTH_PATH="${nginx_health_path}"

issues=0
results=""

add() {
  local status="\$1" label="\$2" detail="\$3"
  results="\${results}\${status}|\${label}|\${detail}\n"
  [[ "\$status" == "FAIL" ]] && issues=\$((issues+1))
  [[ "\$status" == "WARN" ]] && issues=\$((issues+1))
}

# --- Containers ---
for cname in \${CONTAINERS}; do
  state=\$(docker inspect --format='{{.State.Status}}' "\${cname}" 2>/dev/null || echo "missing")
  health=\$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "\${cname}" 2>/dev/null || echo "")
  if [[ "\${state}" == "running" ]]; then
    if [[ "\${health}" == "unhealthy" ]]; then
      add "FAIL" "container:\${cname}" "running but unhealthy"
    elif [[ "\${health}" == "starting" ]]; then
      add "WARN" "container:\${cname}" "running — health starting"
    else
      add "PASS" "container:\${cname}" "running (health: \${health:-n/a})"
    fi
  elif [[ "\${state}" == "missing" ]]; then
    add "FAIL" "container:\${cname}" "not found"
  else
    add "FAIL" "container:\${cname}" "state=\${state}"
  fi
done

# --- Postgres readiness ---
if [[ -n "\${POSTGRES_CONTAINER}" ]]; then
  pg_out=\$(docker exec "\${POSTGRES_CONTAINER}" pg_isready -U "\${POSTGRES_USER}" 2>&1 || true)
  if echo "\${pg_out}" | grep -q "accepting connections"; then
    add "PASS" "postgres" "accepting connections"
  else
    add "FAIL" "postgres" "\${pg_out}"
  fi
fi

# --- API health endpoint ---
if [[ -n "\${PUBLIC_URL}" && -n "\${API_HEALTH_PATH}" ]]; then
  api_url="\${PUBLIC_URL}\${API_HEALTH_PATH}"
  api_code=\$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "\${api_url}" 2>/dev/null || echo "000")
  if [[ "\${api_code}" == "200" ]]; then
    add "PASS" "api-health" "HTTP \${api_code} (\${api_url})"
  else
    add "FAIL" "api-health" "HTTP \${api_code} (\${api_url})"
  fi
fi

# --- Frontend / public URL ---
if [[ -n "\${PUBLIC_URL}" ]]; then
  web_code=\$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "\${PUBLIC_URL}" 2>/dev/null || echo "000")
  if [[ "\${web_code}" =~ ^(200|301|302)$ ]]; then
    add "PASS" "web" "HTTP \${web_code} (\${PUBLIC_URL})"
  else
    add "FAIL" "web" "HTTP \${web_code} (\${PUBLIC_URL})"
  fi
fi

# --- Nginx health endpoint ---
if [[ -n "\${PUBLIC_URL}" && -n "\${NGINX_HEALTH_PATH}" ]]; then
  ng_url="\${PUBLIC_URL}\${NGINX_HEALTH_PATH}"
  ng_code=\$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "\${ng_url}" 2>/dev/null || echo "000")
  if [[ "\${ng_code}" == "200" ]]; then
    add "PASS" "nginx-health" "HTTP \${ng_code}"
  else
    add "WARN" "nginx-health" "HTTP \${ng_code} (\${ng_url})"
  fi
fi

# --- Disk space ---
disk_pct=\$(df -h / | awk 'NR==2 {gsub(/%/,""); print \$5}' 2>/dev/null || echo "0")
disk_avail=\$(df -h / | awk 'NR==2 {print \$4}')
if [[ "\${disk_pct}" -ge 90 ]]; then
  add "FAIL" "disk" "CRITICAL \${disk_pct}% used — \${disk_avail} free"
elif [[ "\${disk_pct}" -ge 80 ]]; then
  add "WARN" "disk" "\${disk_pct}% used — \${disk_avail} free"
else
  add "PASS" "disk" "\${disk_pct}% used — \${disk_avail} free"
fi

# --- Memory ---
mem_total=\$(free -h | awk '/^Mem:/ {print \$2}')
mem_used=\$(free -h  | awk '/^Mem:/ {print \$3}')
mem_pct=\$(free | awk '/^Mem:/ {printf "%d", (\$3/\$2)*100}')
if [[ "\${mem_pct}" -ge 90 ]]; then
  add "FAIL" "memory" "CRITICAL \${mem_pct}% used (\${mem_used}/\${mem_total})"
elif [[ "\${mem_pct}" -ge 80 ]]; then
  add "WARN" "memory" "\${mem_pct}% used (\${mem_used}/\${mem_total})"
else
  add "PASS" "memory" "\${mem_pct}% used (\${mem_used}/\${mem_total})"
fi

# --- Output ---
echo "ISSUES=\${issues}"
echo "---"
printf "\${results}"
PROBE
}

# ── Single environment check ──────────────────────────────────────────────────
check_env() {
  local conf_file="$1"
  local env_slug
  env_slug="$(basename "${conf_file}" .conf)"

  # Load config
  # shellcheck source=/dev/null
  source "${conf_file}"

  # Evaluate variables that may contain $HOME or subshells
  APP_DIR=$(eval echo "${APP_DIR}")

  local start_ts
  start_ts="$(timestamp)"

  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║  ${CYAN}${ENV_NAME}${RESET}${BOLD}  (${env_slug})${RESET}"
  echo -e "${BOLD}║  ${DIM}${start_ts}${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"

  # Build probe and run it
  local probe_script
  probe_script="$(build_probe_script \
    "${APP_DIR}" \
    "${APP_DIR}/${COMPOSE_FILE}" \
    "${CONTAINERS}" \
    "${POSTGRES_CONTAINER}" \
    "${POSTGRES_USER}" \
    "${PUBLIC_URL:-}" \
    "${API_HEALTH_PATH:-}" \
    "${NGINX_HEALTH_PATH:-}")"

  # Connectivity test for remote
  if [[ "${ENV_TYPE}" == "remote" ]]; then
    if [[ -z "${SSH_HOST:-}" ]]; then
      warn "SSH_HOST is not configured for ${ENV_NAME} — skipping"
      return 0
    fi

    info "Connecting to ${SSH_USER}@${SSH_HOST}:${SSH_PORT:-22} …"
    if ! run_cmd "${ENV_TYPE}" "${SSH_HOST}" "${SSH_USER}" "${SSH_KEY:-}" "${SSH_PORT:-22}" \
        "echo connected" >/dev/null 2>&1; then
      fail "Cannot reach ${SSH_HOST} — SSH connection failed"
      return 1
    fi
  fi

  # Execute probe
  local raw_output
  if [[ "${ENV_TYPE}" == "remote" ]]; then
    raw_output=$(run_cmd "${ENV_TYPE}" "${SSH_HOST}" "${SSH_USER}" "${SSH_KEY:-}" "${SSH_PORT:-22}" \
      "bash -s" <<< "${probe_script}" 2>&1) || true
  else
    raw_output=$(bash <(echo "${probe_script}") 2>&1) || true
  fi

  # Parse and display results
  local total_issues=0
  local in_results=false
  local pass_count=0 fail_count=0 warn_count=0

  while IFS= read -r line; do
    if [[ "${line}" =~ ^ISSUES=([0-9]+)$ ]]; then
      total_issues="${BASH_REMATCH[1]}"
    elif [[ "${line}" == "---" ]]; then
      in_results=true
    elif [[ "${in_results}" == true && -n "${line}" ]]; then
      IFS='|' read -r status label detail <<< "${line}"
      case "${status}" in
        PASS) pass "${BOLD}${label}${RESET}  ${DIM}${detail}${RESET}"; pass_count=$((pass_count+1)) ;;
        FAIL) fail "${BOLD}${label}${RESET}  ${detail}"; fail_count=$((fail_count+1)) ;;
        WARN) warn "${BOLD}${label}${RESET}  ${detail}"; warn_count=$((warn_count+1)) ;;
      esac
    fi
  done <<< "${raw_output}"

  # Summary line
  divider
  if [[ "${total_issues}" -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}ALL HEALTHY${RESET}  ${DIM}${pass_count} checks passed${RESET}"
  else
    echo -e "  ${RED}${BOLD}ISSUES FOUND${RESET}  ${GREEN}${pass_count} pass${RESET}  ${YELLOW}${warn_count} warn${RESET}  ${RED}${fail_count} fail${RESET}"
  fi

  # JSON accumulation
  if [[ "${OUTPUT_JSON}" == true ]]; then
    local json_env
    json_env=$(cat <<JSONBLOCK
{
  "env": "${env_slug}",
  "name": "${ENV_NAME}",
  "type": "${ENV_TYPE}",
  "timestamp": "${start_ts}",
  "host": "${SSH_HOST:-localhost}",
  "healthy": $([ "${total_issues}" -eq 0 ] && echo true || echo false),
  "pass": ${pass_count},
  "warn": ${warn_count},
  "fail": ${fail_count}
}
JSONBLOCK
    )
    append_json "${json_env}"
  fi

  # Live logs (optional)
  if [[ "${LIVE_LOGS}" == true ]]; then
    section "Live Logs (Ctrl+C to stop)"
    local logs_cmd="docker compose -f '${APP_DIR}/${COMPOSE_FILE}' logs -f --tail=20"
    if [[ "${ENV_TYPE}" == "remote" ]]; then
      local ssh_opts="-o StrictHostKeyChecking=no -o BatchMode=yes"
      [[ -n "${SSH_KEY:-}" ]] && ssh_opts="${ssh_opts} -i ${SSH_KEY}"
      ssh ${ssh_opts} -p "${SSH_PORT:-22}" "${SSH_USER}@${SSH_HOST}" "${logs_cmd}"
    else
      eval "${logs_cmd}"
    fi
  fi

  return "${total_issues}"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo -e "${BOLD}${CYAN}"
  echo "  ╔═══════════════════════════════════════════════════╗"
  echo "  ║        Smart ACR — Deployment Health Check        ║"
  echo "  ╚═══════════════════════════════════════════════════╝"
  echo -e "${RESET}"

  if [[ ! -d "${ENVS_DIR}" ]]; then
    echo "ERROR: env configs not found at ${ENVS_DIR}" >&2
    exit 1
  fi

  local overall_exit=0

  if [[ -n "${TARGET_ENV}" ]]; then
    # Single environment
    local conf="${ENVS_DIR}/${TARGET_ENV}.conf"
    if [[ ! -f "${conf}" ]]; then
      echo "ERROR: No config for environment '${TARGET_ENV}'" >&2
      echo "Available: $(ls "${ENVS_DIR}"/*.conf | xargs -I{} basename {} .conf | tr '\n' ' ')" >&2
      exit 1
    fi
    check_env "${conf}" || overall_exit=$?
  else
    # All environments
    local found=0
    for conf in "${ENVS_DIR}"/*.conf; do
      [[ -f "${conf}" ]] || continue
      found=$((found+1))
      check_env "${conf}" || overall_exit=1
    done
    if [[ "${found}" -eq 0 ]]; then
      echo "No environment configs found in ${ENVS_DIR}" >&2
      exit 1
    fi
  fi

  # JSON output
  if [[ "${OUTPUT_JSON}" == true ]]; then
    echo ""
    echo -e "${BOLD}JSON Output:${RESET}"
    echo "${JSON_OUTPUT}"
  fi

  echo ""
  if [[ "${overall_exit}" -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}  All environments healthy.${RESET}"
  else
    echo -e "${RED}${BOLD}  One or more environments have issues. Review above.${RESET}"
  fi
  echo ""

  exit "${overall_exit}"
}

main
