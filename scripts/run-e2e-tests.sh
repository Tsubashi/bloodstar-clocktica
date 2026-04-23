#!/usr/bin/env bash
# Runs the Playwright E2E suite against a fresh test stack.
#
# Mirrors scripts/run-api-tests.sh for consistency. Stack up → flush mailhog
# → run Playwright → always tear down.
#
# By default runs Chromium only (fast PR feedback). Override with
# E2E_PROJECTS=all, E2E_PROJECTS=firefox, E2E_PROJECTS=webkit, etc.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  ./scripts/test-stack.sh down
}
trap cleanup EXIT

./scripts/test-stack.sh up

curl -fsS -X DELETE http://localhost:8026/api/v1/messages > /dev/null

# Assemble --project args. Default: chromium only.
projects="${E2E_PROJECTS:-chromium}"
project_args=()
if [ "$projects" != "all" ]; then
  # Split on comma for multi-project selection (e.g., "chromium,firefox")
  IFS=',' read -r -a project_list <<< "$projects"
  for p in "${project_list[@]}"; do
    project_args+=(--project="$p")
  done
fi

npx playwright test "${project_args[@]}" "$@"

# Verify every spec cleaned up its scratch users / editions / published files.
./scripts/test-stack.sh leak-check
