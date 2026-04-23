#!/usr/bin/env bash
# Runs the Hurl API suite against a fresh test stack.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  ./scripts/test-stack.sh down
}
trap cleanup EXIT

./scripts/test-stack.sh up

hurl --test \
  --variables-file tests/api/env.test \
  --report-html tests/api/.hurl-report \
  tests/api/**/*.hurl
