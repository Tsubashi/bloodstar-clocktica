#!/usr/bin/env bash
# Runs the Playwright E2E suite against a fresh test stack.
#
# Mirrors scripts/run-api-tests.sh for consistency. Stack up → flush mailhog
# → run Playwright → always tear down.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  ./scripts/test-stack.sh down
}
trap cleanup EXIT

./scripts/test-stack.sh up

curl -fsS -X DELETE http://localhost:8026/api/v1/messages > /dev/null

npx playwright test "$@"

# Verify every spec cleaned up its scratch users / editions / published files.
./scripts/test-stack.sh leak-check
