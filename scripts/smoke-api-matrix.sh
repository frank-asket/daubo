#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8010/v1}"
TMP_DIR="${TMP_DIR:-.tmp-smoke}"
USER_ID="${SMOKE_USER_ID:-smoke-user-$(date +%s)}"
AUTOPILOT_CONFLICT_ATTEMPTS="${AUTOPILOT_CONFLICT_ATTEMPTS:-6}"
RESUME_TEXT="${SMOKE_RESUME_TEXT:-Senior software engineer with 8 years of FastAPI, React, PostgreSQL, and async worker pipelines.}"

mkdir -p "$TMP_DIR"

if [[ -z "${X_DAUBO_INTERNAL_KEY:-}" && -n "${DAUBO_INTERNAL_API_SECRET:-}" ]]; then
  X_DAUBO_INTERNAL_KEY="${DAUBO_INTERNAL_API_SECRET}"
fi

HEADERS=(-H "X-Daubo-User-Id: ${USER_ID}")
if [[ -n "${X_DAUBO_INTERNAL_KEY:-}" ]]; then
  HEADERS+=(-H "X-Daubo-Internal-Key: ${X_DAUBO_INTERNAL_KEY}")
fi

request() {
  local name="$1"; shift
  local status_file="$TMP_DIR/${name}.status"
  local body_file="$TMP_DIR/${name}.json"
  local code
  code="$(curl -sS --max-time 20 -o "$body_file" -w "%{http_code}" "${HEADERS[@]}" "$@" || true)"
  printf "%s" "$code" > "$status_file"
  echo "$code"
}

expect_status() {
  local name="$1"; shift
  local got="$1"; shift
  local ok=1
  for expected in "$@"; do
    if [[ "$got" == "$expected" ]]; then
      ok=0
      break
    fi
  done
  if [[ $ok -ne 0 ]]; then
    echo "❌ ${name}: expected [$*], got ${got}"
    return 1
  fi
  echo "✅ ${name}: ${got}"
}

echo "Running smoke matrix against ${BASE_URL}"
echo "User: ${USER_ID}"

# Phase A: seed resume for happy-path autopilot
seed_status="$(request seed_resume -X PUT -H "Content-Type: application/json" \
  --data "{\"content_text\":\"${RESUME_TEXT}\",\"file_name\":\"smoke-resume.txt\"}" \
  "${BASE_URL}/me/resume")"

# Phase B: baseline endpoint checks
prefs_get_status="$(request prefs_get "${BASE_URL}/me/preferences")"
prefs_patch_status="$(request prefs_patch -X PATCH -H "Content-Type: application/json" \
  --data '{"target_role":"Staff Engineer","location_preference":"Remote","min_salary_usd":180000,"seniority":"staff","skills_highlight":"python,fastapi,react"}' \
  "${BASE_URL}/me/preferences")"
jobs_status="$(request jobs "${BASE_URL}/jobs?min_fit=0.20&location=Remote&page=1&page_size=5")"
sse_status="$(request sse -N "${BASE_URL}/agents/status")"

# Phase C: autopilot happy-path
autopilot_happy_status="$(request autopilot_happy -X POST -H "Content-Type: application/json" \
  --data '{"limit":1}' "${BASE_URL}/me/autopilot/run")"

# Phase D: autopilot conflict-path (retry a few times to observe overlap lock)
conflict_observed=0
conflict_a_status=""
conflict_b_status=""
for i in $(seq 1 "$AUTOPILOT_CONFLICT_ATTEMPTS"); do
  (
    request "autopilot_conflict_${i}_a" -X POST -H "Content-Type: application/json" \
      --data '{"limit":1}' "${BASE_URL}/me/autopilot/run" > "$TMP_DIR/autopilot_conflict_${i}_a.out"
  ) &
  pid_a=$!
  (
    request "autopilot_conflict_${i}_b" -X POST -H "Content-Type: application/json" \
      --data '{"limit":1}' "${BASE_URL}/me/autopilot/run" > "$TMP_DIR/autopilot_conflict_${i}_b.out"
  ) &
  pid_b=$!
  wait "$pid_a"
  wait "$pid_b"
  conflict_a_status="$(cat "$TMP_DIR/autopilot_conflict_${i}_a.out")"
  conflict_b_status="$(cat "$TMP_DIR/autopilot_conflict_${i}_b.out")"
  if [[ "$conflict_a_status" == "409" || "$conflict_b_status" == "409" ]]; then
    conflict_observed=1
    break
  fi
done

echo
echo "Matrix:"

failures=0
expect_status "seed resume" "$seed_status" 200 || failures=$((failures+1))
expect_status "preferences get" "$prefs_get_status" 200 || failures=$((failures+1))
expect_status "preferences patch" "$prefs_patch_status" 200 || failures=$((failures+1))
expect_status "jobs filters" "$jobs_status" 200 || failures=$((failures+1))
expect_status "agents status SSE" "$sse_status" 200 || failures=$((failures+1))
expect_status "autopilot happy-path" "$autopilot_happy_status" 200 || failures=$((failures+1))

if [[ "$conflict_observed" -eq 1 ]]; then
  echo "✅ autopilot conflict-path: observed 409 with pair (${conflict_a_status}, ${conflict_b_status})"
else
  echo "❌ autopilot conflict-path: no 409 observed after ${AUTOPILOT_CONFLICT_ATTEMPTS} attempts"
  failures=$((failures+1))
fi

echo
echo "Artifacts written to ${TMP_DIR}"

if [[ "$failures" -gt 0 ]]; then
  echo "Smoke matrix failed with ${failures} issue(s)."
  exit 1
fi

echo "Smoke matrix is fully green."
