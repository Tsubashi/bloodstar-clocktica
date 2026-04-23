#!/usr/bin/env bash
# Runs the Hurl API suite against a fresh test stack.
#
# Why `--jobs 1`:
#   Every .hurl file that captures a mailhog confirmation code uses
#   `$.items[0].Content.Body` — the newest message. Mailhog's inbox is
#   shared global state; parallel files would race and read each other's
#   codes. DO NOT remove `--jobs 1` without also rewriting every mailhog
#   capture to filter by recipient address.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  ./scripts/test-stack.sh down
}
trap cleanup EXIT

./scripts/test-stack.sh up

# Flush mailhog inbox so this run starts from a known-empty state.
curl -fsS -X DELETE http://localhost:8026/api/v1/messages > /dev/null

hurl --test \
  --jobs 1 \
  --variables-file tests/api/env.test \
  --report-html tests/api/.hurl-report \
  tests/api/**/*.hurl

# Verify every test cleaned up its scratch users / editions / published files.
# Catches slipped teardowns that would otherwise accumulate silently.
./scripts/test-stack.sh leak-check
