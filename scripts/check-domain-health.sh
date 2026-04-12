#!/usr/bin/env bash
set -euo pipefail

# This script is intentionally read-only.
# It checks nameserver delegation, API resolution, and Worker health,
# writes a timestamped Markdown report, and exits nonzero on failure.

DOMAIN="${DOMAIN:-reportingforge.com}"
API_DOMAIN="${API_DOMAIN:-api.reportingforge.com}"
API_HEALTH_URL="${API_HEALTH_URL:-https://api.reportingforge.com/health}"
WORKERS_DEV_HEALTH_URL="${WORKERS_DEV_HEALTH_URL:-https://rf-webhooks.nmoloney1968.workers.dev/health}"
SKIP_WORKERS_DEV="${SKIP_WORKERS_DEV:-0}"

EXPECTED_NS_1="kia.ns.cloudflare.com"
EXPECTED_NS_2="roan.ns.cloudflare.com"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORTS_DIR="${REPO_ROOT}/reports"
TIMESTAMP="$(date -u +"%Y%m%d-%H%M%S")"
REPORT_PATH="${REPORTS_DIR}/domain-health-${TIMESTAMP}Z.md"

mkdir -p "${REPORTS_DIR}"

declare -a FAILURES=()
declare -a NOTES=()

normalize_host() {
  local value="${1:-}"
  value="${value%.}"
  printf '%s' "${value}" | tr '[:upper:]' '[:lower:]'
}

join_by() {
  local delimiter="$1"
  shift
  local first=1
  for item in "$@"; do
    if [[ ${first} -eq 1 ]]; then
      printf '%s' "${item}"
      first=0
    else
      printf '%s%s' "${delimiter}" "${item}"
    fi
  done
}

get_nameservers() {
  local name="$1"

  if command -v dig >/dev/null 2>&1; then
    dig +short NS "${name}" | sed 's/\.$//' | tr '[:upper:]' '[:lower:]' | sort -u
    return 0
  fi

  if command -v nslookup >/dev/null 2>&1; then
    nslookup -type=NS "${name}" 2>/dev/null | awk -F'= ' '/nameserver = / {print $2}' | sed 's/\.$//' | tr '[:upper:]' '[:lower:]' | sort -u
    return 0
  fi

  NOTES+=("No dig/nslookup found for NS lookup. Falling back to Cloudflare DNS over HTTPS.")
  curl -fsSL "https://cloudflare-dns.com/dns-query?name=${name}&type=NS" \
    -H 'accept: application/dns-json' \
    | sed 's/[{}]/\n/g' \
    | awk -F'"data":"' '/"data":"/ {print $2}' \
    | awk -F'"' '{print $1}' \
    | sed 's/\.$//' \
    | tr '[:upper:]' '[:lower:]' \
    | sort -u
}

resolve_host() {
  local name="$1"

  if command -v getent >/dev/null 2>&1; then
    getent ahosts "${name}" 2>/dev/null | awk '{print $1}' | sort -u
    return 0
  fi

  if command -v nslookup >/dev/null 2>&1; then
    nslookup "${name}" 2>/dev/null | awk '/^Address: / {print $2}' | sort -u
    return 0
  fi

  NOTES+=("No local resolver command found for ${name}. Falling back to Cloudflare DNS over HTTPS.")
  curl -fsSL "https://cloudflare-dns.com/dns-query?name=${name}&type=A" \
    -H 'accept: application/dns-json' \
    | sed 's/[{}]/\n/g' \
    | awk -F'"data":"' '/"data":"/ {print $2}' \
    | awk -F'"' '{print $1}' \
    | sort -u
}

health_check() {
  local label="$1"
  local url="$2"

  # curl writes body to stdout and status code to the trailer line.
  local raw
  if ! raw="$(curl -fsS --max-time 20 -w $'\n%{http_code}' "${url}" 2>&1)"; then
    printf '%s|0|false|false|FAIL|curl_failed\n' "${label}"
    return 0
  fi

  local status body normalized
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

  printf '%s|%s|%s|%s|%s|\n' "${label}" "${status}" "${body_ok}" "${parsed_ok}" "${result}"
}

mapfile -t OBSERVED_NS < <(get_nameservers "${DOMAIN}")
EXPECTED_JOINED="$(join_by ',' "${EXPECTED_NS_1}" "${EXPECTED_NS_2}")"
OBSERVED_JOINED="$(join_by ',' "${OBSERVED_NS[@]:-}")"

if [[ "${OBSERVED_JOINED}" != "${EXPECTED_JOINED}" ]]; then
  FAILURES+=("Nameserver mismatch for ${DOMAIN}. Expected: ${EXPECTED_NS_1}, ${EXPECTED_NS_2}. Observed: ${OBSERVED_JOINED:-none}.")
fi

mapfile -t API_RESOLUTION < <(resolve_host "${API_DOMAIN}")
if [[ ${#API_RESOLUTION[@]} -eq 0 ]]; then
  FAILURES+=("Failed to resolve ${API_DOMAIN}.")
fi

IFS='|' read -r API_LABEL API_STATUS API_BODY_OK API_PARSED_OK API_RESULT API_ERROR <<< "$(health_check "API custom domain" "${API_HEALTH_URL}")"
if [[ "${API_RESULT}" != "PASS" ]]; then
  FAILURES+=("Health check failed for ${API_HEALTH_URL}. Status=${API_STATUS}. Error=${API_ERROR:-none}.")
fi

WORKERS_LINE=""
if [[ "${SKIP_WORKERS_DEV}" != "1" ]]; then
  WORKERS_LINE="$(health_check "workers.dev fallback" "${WORKERS_DEV_HEALTH_URL}")"
  IFS='|' read -r WORKERS_LABEL WORKERS_STATUS WORKERS_BODY_OK WORKERS_PARSED_OK WORKERS_RESULT WORKERS_ERROR <<< "${WORKERS_LINE}"
  if [[ "${WORKERS_RESULT}" != "PASS" ]]; then
    FAILURES+=("Optional workers.dev health check failed for ${WORKERS_DEV_HEALTH_URL}. Status=${WORKERS_STATUS}. Error=${WORKERS_ERROR:-none}.")
  fi
fi

{
  echo "# Domain Health Report"
  echo
  echo "- Generated at UTC: $(date -u +"%Y-%m-%d %H:%M:%S")"
  echo "- Domain: \`${DOMAIN}\`"
  echo "- API domain: \`${API_DOMAIN}\`"
  echo "- API health URL: <${API_HEALTH_URL}>"
  echo "- workers.dev health URL: <${WORKERS_DEV_HEALTH_URL}>"
  echo
  echo "## Expected nameservers"
  echo
  echo "- \`${EXPECTED_NS_1}\`"
  echo "- \`${EXPECTED_NS_2}\`"
  echo
  echo "## Observed nameservers"
  echo
  if [[ ${#OBSERVED_NS[@]} -gt 0 ]]; then
    for ns in "${OBSERVED_NS[@]}"; do
      echo "- \`${ns}\`"
    done
  else
    echo "- none"
  fi
  echo
  echo "## API resolution"
  echo
  if [[ ${#API_RESOLUTION[@]} -gt 0 ]]; then
    for addr in "${API_RESOLUTION[@]}"; do
      echo "- \`${addr}\`"
    done
  else
    echo "- resolution failed"
  fi
  echo
  echo "## Health checks"
  echo
  echo "| Target | Status | Body ok | Parsed ok | Result |"
  echo "|---|---:|---:|---:|---|"
  echo "| ${API_LABEL} | ${API_STATUS} | ${API_BODY_OK} | ${API_PARSED_OK} | ${API_RESULT} |"
  if [[ -n "${WORKERS_LINE}" ]]; then
    echo "| ${WORKERS_LABEL} | ${WORKERS_STATUS} | ${WORKERS_BODY_OK} | ${WORKERS_PARSED_OK} | ${WORKERS_RESULT} |"
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
  echo
  echo "## Notes"
  echo
  if [[ ${#NOTES[@]} -gt 0 ]]; then
    for note in "${NOTES[@]}"; do
      echo "- ${note}"
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
