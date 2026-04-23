#!/usr/bin/env bash
# Wrapper around docker-compose.test.yaml. Single entrypoint used by
# npm scripts, CI, and humans.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="bloodstar-test"
COMPOSE_FILE="docker-compose.test.yaml"
COMPOSE=(docker compose -f "$COMPOSE_FILE" -p "$PROJECT")

wait_for_health() {
  local service="app"
  local retries=60
  local delay=2
  echo "Waiting for $service to become healthy..."
  for i in $(seq 1 "$retries"); do
    local cid
    cid=$("${COMPOSE[@]}" ps -q "$service" 2>/dev/null || true)
    local status=""
    if [ -n "$cid" ]; then
      status=$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || true)
    fi
    if [ "$status" = "healthy" ]; then
      echo "$service is healthy"
      return 0
    fi
    sleep "$delay"
  done
  echo "ERROR: $service did not become healthy in $((retries * delay))s" >&2
  "${COMPOSE[@]}" ps
  "${COMPOSE[@]}" logs --tail=100 "$service"
  return 1
}

cmd_up() {
  "${COMPOSE[@]}" up -d --build
  if ! wait_for_health; then
    echo "Tearing down partially-started stack..." >&2
    "${COMPOSE[@]}" down -v
    return 1
  fi
}

cmd_down() {
  "${COMPOSE[@]}" down -v
}

cmd_logs() {
  "${COMPOSE[@]}" logs --tail=200 "$@"
}

cmd_wait() {
  wait_for_health
}

# Verify no scratch users or edition artifacts leaked after a test run.
# Exits non-zero if anything persists. Safe to call with stack running.
cmd_leak_check() {
  local leaked=0

  # DB tables: should all be empty after teardowns ran.
  local tables="users hash unconfirmed reset share block"
  for tbl in $tables; do
    local count
    count=$("${COMPOSE[@]}" exec -T db mariadb \
      -ubloodstar_user -pbloodstar_test_password bloodstar_db \
      -sN -e "SELECT COUNT(*) FROM \`$tbl\`;" 2>/dev/null | tr -d '[:space:]')
    if [ -z "$count" ]; then
      echo "LEAK CHECK: could not read row count for $tbl" >&2
      leaked=1
    elif [ "$count" != "0" ]; then
      echo "LEAK CHECK: $tbl has $count row(s) remaining" >&2
      leaked=1
    fi
  done

  # Filesystem: user-save dirs should be gone (deleteaccount.php handles this).
  local usersave_count
  usersave_count=$("${COMPOSE[@]}" exec -T app \
    sh -c 'find /var/www/html/usersave -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l' \
    | tr -d '[:space:]')
  if [ -n "$usersave_count" ] && [ "$usersave_count" != "0" ]; then
    echo "LEAK CHECK: /var/www/html/usersave has $usersave_count user dir(s) remaining" >&2
    leaked=1
  fi

  # Filesystem: published dirs should be gone. Known caveat: deleteaccount.php
  # only removes usersave, not /p/. If this leaks, either the test explicitly
  # calls delete.php before deleteaccount, or we fix deleteaccount.php to
  # clean up /p/<username>/ too.
  local published_count
  published_count=$("${COMPOSE[@]}" exec -T app \
    sh -c 'find /var/www/html/p -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l' \
    | tr -d '[:space:]')
  if [ -n "$published_count" ] && [ "$published_count" != "0" ]; then
    echo "LEAK CHECK: /var/www/html/p has $published_count user dir(s) remaining" >&2
    leaked=1
  fi

  if [ "$leaked" -ne 0 ]; then
    return 1
  fi
  echo "Leak check: clean (DB tables empty, usersave empty, published empty)"
}

case "${1:-}" in
  up)         cmd_up ;;
  down)       cmd_down ;;
  wait)       cmd_wait ;;
  logs)       shift; cmd_logs "$@" ;;
  leak-check) cmd_leak_check ;;
  *)          echo "usage: $0 {up|down|wait|logs [service]|leak-check}" >&2; exit 2 ;;
esac
