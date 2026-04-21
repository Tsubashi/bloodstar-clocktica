# Tests

Three test layers. See
[`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md)
for the full design.

| Dir   | Framework  | Purpose                                                     |
|-------|------------|-------------------------------------------------------------|
| unit/ | Vitest     | Pure TypeScript: model, validation, team-color, etc.        |
| api/  | Hurl       | HTTP contract against the test Compose stack                |
| e2e/  | Playwright | Browser-level flows against the test Compose stack          |

## Running

| Command              | What it does                                                |
|----------------------|-------------------------------------------------------------|
| `npm test`           | Vitest unit suite. No Docker required.                      |
| `npm run test:api`   | Brings up the test stack, runs Hurl, tears down.            |
| `npm run test:e2e`   | Brings up the test stack, runs Playwright, tears down.      |
| `npm run test:e2e:ui`| Playwright UI mode for interactive debugging.               |
| `npm run test:all`   | Unit → API → E2E. Fail-fast.                                |

The stack itself is controlled via `scripts/test-stack.sh {up,down,wait,logs}`
if you need to run it independently.

## Fixtures

- `tests/fixtures/protected/` — throwaway JWT keys and DB config. Bind-mounted
  read-only into the app container.
- `tests/fixtures/published/` — default `almanac.css` / `print.css` seeded
  into the app's published-dir volume on up.

These files are *test* fixtures — never reuse them in any deployed system.
