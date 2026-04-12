#!/usr/bin/env bash
set -euo pipefail

# This script is intentionally read-only.
# It performs health checks against the custom domain and workers.dev fallback,
# writes a Markdown report, and exits nonzero if any required check fails.

API_HEALTH_URL="${API_HEALTH_URL:-https://api.reportingforge.com/health}"
WORKERS_DEV_HEALTH_URL="${WORKERS_DEV_HEALTH_URL:-https://rf-webhooks.nmoloney1968.workers.dev/health}"
SKIP_WORKERS_DEV="${SKIP_WORKERS_DEV:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORTS_DIR="${REPO_ROOT}/reports"
TIMESTAMP="$(date -u +"%Y%m%d-%H%M%S")"
REPORT_PATH="${REPORTS_DIR}/worker-health-${TIMESTAMP}Z.md"

mkdir -p "${REPORTS_DIR}"

declare -a FAILURES=()

health_check() {
  local label="$1"
  local url="$2"
  local start_ms end_ms elapsed_ms raw status body normalized

  start_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"

  if ! raw="$(curl -fsS --max-time 20 -w $'\n%{http_code}' "${url}" 2>&1)"; then
    end_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
    elapsed_ms="$((end_ms - start_ms))"
    printf '%s|0|%s|false|false|FAIL|curl_failed\n' "${label}" "${elapsed_ms}"
    return 0
  fi

  end_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
  elapsed_ms="$((end_ms - start_ms))"

  status="$(printf '%s' "${raw}" | tail -n 1)"
  body="$(printf '%s' "${raw}" | sed '$d')"
  normalized="$(printf '%s' "${body}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"

  local body_ok="false"
  if [[ "${normalized}" == *'{"ok":true}'* || "${normalized}" == *'"ok":true'* ]]; then
    body_ok="true"
  fi

  local parsed_ok="false"
  if [[ "${normalized}" =~ \"ok\":true ]]; then
    parsed_ok="true"
  fi

  local result="FAIL"
  if [[ "${status}" == "200" && ( "${body_ok}" == "true" || "${parsed_ok}" == "true" ) ]]; then
    result="PASS"
  fi

  printf '%s|%s|%s|%s|%s|%s|\n' "${label}" "${status}" "${elapsed_ms}" "${body_ok}" "${parsed_ok}" "${result}"
}

IFS='|' read -r API_LABEL API_STATUS API_MS API_BODY_OK API_PARSED_OK API_RESULT <<< "$(health_check "API custom domain" "${API_HEALTH_URL}")"
if [[ "${API_RESULT}" != "PASS" ]]; then
  FAILURES+=("Health check failed for ${API_HEALTH_URL}. Status=${API_STATUS}.")
fi

WORKERS_LINE=""
if [[ "${SKIP_WORKERS_DEV}" != "1" ]]; then
  WORKERS_LINE="$(health_check "workers.dev fallback" "${WORKERS_DEV_HEALTH_URL}")"
  IFS='|' read -r WORKERS_LABEL WORKERS_STATUS WORKERS_MS WORKERS_BODY_OK WORKERS_PARSED_OK WORKERS_RESULT <<< "${WORKERS_LINE}"
  if [[ "${WORKERS_RESULT}" != "PASS" ]]; then
    FAILURES+=("Health check failed for ${WORKERS_DEV_HEALTH_URL}. Status=${WORKERS_STATUS}.")
  fi
fi

{
  echo "# Worker Health Report"
  echo
  echo "- Generated at UTC: $(date -u +"%Y-%m-%d %H:%M:%S")"
  echo "- API health URL: <${API_HEALTH_URL}>"
  echo "- workers.dev health URL: <${WORKERS_DEV_HEALTH_URL}>"
  echo
  echo "## Results"
  echo
  echo "| Target | Status | Time ms | Body ok | Parsed ok | Result |"
  echo "|---|---:|---:|---:|---:|---|"
  echo "| ${API_LABEL} | ${API_STATUS} | ${API_MS} | ${API_BODY_OK} | ${API_PARSED_OK} | ${API_RESULT} |"
  if [[ -n "${WORKERS_LINE}" ]]; then
    echo "| ${WORKERS_LABEL} | ${WORKERS_STATUS} | ${WORKERS_MS} | ${WORKERS_BODY_OK} | ${WORKERS_PARSED_OK} | ${WORKERS_RESULT} |"
  fi
  echo
  echo "## Failures"
  echo
  if [[ ${#FAILURES[@]} -gt 0 ]]; then
    for failure in "${FAILURES[@]}"; do
      echo "- ${failure}"
    done
  else
    echo "- none"
  fi
} > "${REPORT_PATH}"

echo "Report written to ${REPORT_PATH}"

if [[ ${#FAILURES[@]} -gt 0 ]]; then
  exit 1
fi

exit 0
