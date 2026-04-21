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

case "${1:-}" in
  up)    cmd_up ;;
  down)  cmd_down ;;
  wait)  cmd_wait ;;
  logs)  shift; cmd_logs "$@" ;;
  *)     echo "usage: $0 {up|down|wait|logs [service]}" >&2; exit 2 ;;
esac
