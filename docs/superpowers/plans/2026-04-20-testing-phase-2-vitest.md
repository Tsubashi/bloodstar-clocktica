# Testing — Phase 2: Vitest Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fast, pure-Node Vitest unit-test suite covering 10 TypeScript modules whose exported surface is free of DOM, network, or storage side effects. Replace the placeholder `npm test` script so `.github/workflows/unit.yml` runs real tests on every push.

**Architecture:** Vitest runs in Node (no jsdom) against `tests/unit/**/*.test.ts`. The existing `src/bind/` framework (`Property<T>`, `ObservableObject<T>.serialize()`) is pure at the module-load level, so model classes can be instantiated via `new Cls()` and exercised directly. Impure methods (`asyncNew`, `regenerateStyledImage`, DOM-updating functions) are *skip-listed* — tested in later Playwright phases, not here.

**Tech Stack:** Vitest (test runner/assertion), `tsx`/esbuild (TS compilation via Vitest defaults), existing `tsconfig.json` with `experimentalDecorators: true`.

**Scope (scope decision A):** 10 modules (6 GREEN + 4 YELLOW). The RED trio — `state-history.ts`, `team-color.ts`, `recent-file.ts` — is OUT of this phase; they're covered later by Playwright.

**Spec reference:** [`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../specs/2026-04-20-testing-infrastructure-design.md)

**User preference:** The user runs all `git commit` commands themselves (gpg-signing blocks non-interactive shells). This plan presents each commit as a command, not as a subagent action.

---

## Task 1: Install Vitest and configure it

Add Vitest as a dev dependency, create `vitest.config.ts`, and write one tiny smoke test that imports a real model file — proving the toolchain handles decorators, class-field assignment, and ESM/TS resolution before we scale up.

**Files:**
- Modify: `package.json` (add `vitest` to `devDependencies`; replace the `test` placeholder script)
- Create: `vitest.config.ts`
- Create: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Install Vitest**

Run (npm since CI also uses npm):
```bash
npm install --save-dev vitest
```
Expected: `package.json` gains `"vitest": "^<version>"` under `devDependencies`, `package-lock.json` is updated. Vitest today is ~v1.x or ~v2.x — any recent version is fine.

- [ ] **Step 2: Create `vitest.config.ts` at repo root**

Write:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    clearMocks: true,
  },
  esbuild: {
    target: 'es2018',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
});
```

Rationale:
- `environment: 'node'` keeps tests fast and forces DOM-free code.
- `globals: false` means tests must `import { describe, it, expect } from 'vitest'` explicitly — no hidden magic.
- The `esbuild` block mirrors the `experimentalDecorators: true` from `tsconfig.json` so decorated model classes (e.g., `EditionAlmanac`) compile correctly. `useDefineForClassFields: false` matches TypeScript's default for targets older than ES2022, which the repo uses.

- [ ] **Step 3: Replace the placeholder `test` script**

Open `package.json`. Change:
```json
"test": "echo 'Unit tests arrive in Phase 2 (Vitest).' && exit 0",
```
to:
```json
"test": "vitest run",
```

Leave all other scripts alone. (Optional developer convenience, also add:)
```json
"test:watch": "vitest",
```
— not required, but nice. If added, place it right after `"test"`.

- [ ] **Step 4: Write a one-line smoke test**

Create `tests/unit/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditionAlmanac } from '../../src/model/edition-almanac';

describe('Vitest smoke', () => {
  it('imports and instantiates a decorated model class', () => {
    const a = new EditionAlmanac();
    expect(a.synopsis.get()).toBe('');
    expect(a.overview.get()).toBe('');
    expect(a.changelog.get()).toBe('');
  });
});
```

Why `EditionAlmanac`? It's the smallest class that exercises the decorator machinery and `Property<T>.get()`. If Vitest can run this test, all the other model tests below will work too.

- [ ] **Step 5: Run the smoke test**

```bash
npm test
```

Expected:
```
 ✓ tests/unit/smoke.test.ts (1 test) ...
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

Common failure modes and fixes:
- `SyntaxError: Unexpected token '@'` or similar decorator error → `esbuild.tsconfigRaw.compilerOptions.experimentalDecorators` wasn't applied. Re-check `vitest.config.ts`.
- `Cannot find module '../../src/model/edition-almanac'` → path in the test is wrong; verify relative to `tests/unit/smoke.test.ts`.
- `TypeError: Cannot read properties of undefined (reading 'get')` — most likely means class fields aren't being initialized by the decorator. Ensure `useDefineForClassFields: false` is in the esbuild block.

- [ ] **Step 6: Stage**

```bash
git add package.json package-lock.json vitest.config.ts tests/unit/smoke.test.ts
git status --short
```
Expected: four entries (three `M`/`A`, one `A`), nothing else.

- [ ] **Step 7: Commit (user runs)**

```bash
git commit -m "Install Vitest and add smoke test for pure-Node model imports"
```

---

## Task 2: Test `src/model/blood-team.ts`

`BloodTeam` is a plain string enum with three helpers: `parseBloodTeam`, `bloodTeamDisplayString`, and the `BLOODTEAM_OPTIONS` const. No observable machinery — pure functions. Good starting point.

**Files:**
- Create: `tests/unit/model/blood-team.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  BloodTeam,
  parseBloodTeam,
  bloodTeamDisplayString,
  BLOODTEAM_OPTIONS,
} from '../../../src/model/blood-team';

describe('parseBloodTeam', () => {
  it('maps lowercase values to enum', () => {
    expect(parseBloodTeam('townsfolk')).toBe(BloodTeam.TOWNSFOLK);
    expect(parseBloodTeam('outsider')).toBe(BloodTeam.OUTSIDER);
    expect(parseBloodTeam('minion')).toBe(BloodTeam.MINION);
    expect(parseBloodTeam('demon')).toBe(BloodTeam.DEMON);
    expect(parseBloodTeam('traveller')).toBe(BloodTeam.TRAVELLER);
    expect(parseBloodTeam('fabled')).toBe(BloodTeam.FABLED);
    expect(parseBloodTeam('jinxes')).toBe(BloodTeam.JINXES);
  });

  it('is case-insensitive', () => {
    expect(parseBloodTeam('TOWNSFOLK')).toBe(BloodTeam.TOWNSFOLK);
    expect(parseBloodTeam('Demon')).toBe(BloodTeam.DEMON);
  });

  it('accepts "traveler" (US spelling) as an alias for "traveller"', () => {
    expect(parseBloodTeam('traveler')).toBe(BloodTeam.TRAVELLER);
    expect(parseBloodTeam('TRAVELER')).toBe(BloodTeam.TRAVELLER);
  });

  it('throws on unknown values', () => {
    expect(() => parseBloodTeam('wizard')).toThrow(/unhandled team wizard/);
    expect(() => parseBloodTeam('')).toThrow(/unhandled team /);
  });
});

describe('bloodTeamDisplayString', () => {
  it('returns the display string for each team enum value', () => {
    expect(bloodTeamDisplayString(BloodTeam.TOWNSFOLK)).toBe('Townsfolk');
    expect(bloodTeamDisplayString(BloodTeam.OUTSIDER)).toBe('Outsider');
    expect(bloodTeamDisplayString(BloodTeam.MINION)).toBe('Minion');
    expect(bloodTeamDisplayString(BloodTeam.DEMON)).toBe('Demon');
    expect(bloodTeamDisplayString(BloodTeam.TRAVELLER)).toBe('Traveller');
    expect(bloodTeamDisplayString(BloodTeam.FABLED)).toBe('Fabled');
    expect(bloodTeamDisplayString(BloodTeam.JINXES)).toBe('Jinxes');
  });

  it('throws on unknown input', () => {
    expect(() => bloodTeamDisplayString('wizard' as BloodTeam)).toThrow(/unhandled team wizard/);
  });
});

describe('BLOODTEAM_OPTIONS', () => {
  it('contains exactly the 7 non-display teams in canonical order', () => {
    expect(BLOODTEAM_OPTIONS).toHaveLength(7);
    expect(BLOODTEAM_OPTIONS.map(o => o.value)).toEqual([
      BloodTeam.TOWNSFOLK,
      BloodTeam.OUTSIDER,
      BloodTeam.MINION,
      BloodTeam.DEMON,
      BloodTeam.TRAVELLER,
      BloodTeam.FABLED,
      BloodTeam.JINXES,
    ]);
  });

  it('pairs each value with its capitalized display string', () => {
    for (const { display, value } of BLOODTEAM_OPTIONS) {
      expect(display).toBe(bloodTeamDisplayString(value));
    }
  });
});
```

- [ ] **Step 2: Run just this test file**

```bash
npx vitest run tests/unit/model/blood-team.test.ts
```
Expected: all assertions pass.

- [ ] **Step 3: Run the full suite**

```bash
npm test
```
Expected: smoke test + all new tests pass. Count should be 5 tests (smoke = 1, blood-team = 4 describes with several assertions each, counted by Vitest as individual `it` blocks).

- [ ] **Step 4: Stage + commit (user runs)**

```bash
git add tests/unit/model/blood-team.test.ts
git commit -m "Add unit tests for BloodTeam enum helpers"
```

---

## Task 3: Test `src/model/special.ts`

Same structure as `blood-team.ts`: enum + parse + OPTIONS array.

**Files:**
- Create: `tests/unit/model/special.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  BloodSpecial,
  parseSpecial,
  SPECIAL_OPTIONS,
} from '../../../src/model/special';

describe('parseSpecial', () => {
  it('maps lowercase values to enum', () => {
    expect(parseSpecial('none')).toBe(BloodSpecial.NONE);
    expect(parseSpecial('showgrimoire')).toBe(BloodSpecial.SHOW_GRIMOIRE);
    expect(parseSpecial('point')).toBe(BloodSpecial.POINT);
  });

  it('is case-insensitive', () => {
    expect(parseSpecial('NONE')).toBe(BloodSpecial.NONE);
    expect(parseSpecial('ShowGrimoire')).toBe(BloodSpecial.SHOW_GRIMOIRE);
    expect(parseSpecial('SHOWGRIMOIRE')).toBe(BloodSpecial.SHOW_GRIMOIRE);
  });

  it('throws on unknown values', () => {
    expect(() => parseSpecial('invisible')).toThrow(/unhandled value "invisible"/);
    expect(() => parseSpecial('')).toThrow(/unhandled value ""/);
  });
});

describe('SPECIAL_OPTIONS', () => {
  it('contains exactly the 3 specials in canonical order', () => {
    expect(SPECIAL_OPTIONS).toHaveLength(3);
    expect(SPECIAL_OPTIONS.map(o => o.value)).toEqual([
      BloodSpecial.NONE,
      BloodSpecial.SHOW_GRIMOIRE,
      BloodSpecial.POINT,
    ]);
  });

  it('pairs each value with its display string', () => {
    expect(SPECIAL_OPTIONS[0]).toEqual({ display: 'None', value: BloodSpecial.NONE });
    expect(SPECIAL_OPTIONS[1]).toEqual({ display: 'Show Grimoire', value: BloodSpecial.SHOW_GRIMOIRE });
    expect(SPECIAL_OPTIONS[2]).toEqual({ display: 'Point', value: BloodSpecial.POINT });
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 3: Commit (user runs)**

```bash
git add tests/unit/model/special.test.ts
git commit -m "Add unit tests for BloodSpecial enum helpers"
```

---

## Task 4: Test the four simple data-container models

`CharacterAlmanac`, `EditionAlmanac`, `EditionMeta`, `CharacterImageSettings` are all ObservableObjects with only `Property<T>` fields. Tests follow the same shape: instantiate, check defaults, set a property, re-check, serialize, check the result.

**Files:**
- Create: `tests/unit/model/character-almanac.test.ts`
- Create: `tests/unit/model/edition-almanac.test.ts`
- Create: `tests/unit/model/edition-meta.test.ts`
- Create: `tests/unit/model/character-image-settings.test.ts`

- [ ] **Step 1: `character-almanac.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { CharacterAlmanac } from '../../../src/model/character-almanac';

describe('CharacterAlmanac', () => {
  it('defaults all five string properties to the empty string', () => {
    const c = new CharacterAlmanac();
    expect(c.examples.get()).toBe('');
    expect(c.flavor.get()).toBe('');
    expect(c.howToRun.get()).toBe('');
    expect(c.overview.get()).toBe('');
    expect(c.tip.get()).toBe('');
  });

  it('serializes to an empty object when all properties are at default', async () => {
    const c = new CharacterAlmanac();
    await expect(c.serialize()).resolves.toEqual({});
  });

  it('serializes only the fields that have been set', async () => {
    const c = new CharacterAlmanac();
    await c.flavor.set('spooky');
    await c.tip.set('hold tight');
    const out = await c.serialize();
    expect(out).toEqual({ flavor: 'spooky', tip: 'hold tight' });
  });

  it('round-trips through serialize/deserialize', async () => {
    const a = new CharacterAlmanac();
    await a.examples.set('example');
    await a.howToRun.set('instructions');
    const data = await a.serialize();

    const b = new CharacterAlmanac();
    await b.deserialize(data as Record<string, unknown>);
    expect(b.examples.get()).toBe('example');
    expect(b.howToRun.get()).toBe('instructions');
    expect(b.flavor.get()).toBe('');
  });
});
```

- [ ] **Step 2: `edition-almanac.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { EditionAlmanac } from '../../../src/model/edition-almanac';

describe('EditionAlmanac', () => {
  it('defaults the three string properties to the empty string', () => {
    const a = new EditionAlmanac();
    expect(a.synopsis.get()).toBe('');
    expect(a.overview.get()).toBe('');
    expect(a.changelog.get()).toBe('');
  });

  it('serializes to {} when at default', async () => {
    const a = new EditionAlmanac();
    await expect(a.serialize()).resolves.toEqual({});
  });

  it('serializes only non-default fields and round-trips', async () => {
    const a = new EditionAlmanac();
    await a.synopsis.set('synop');
    await a.changelog.set('v1');
    const data = await a.serialize();
    expect(data).toEqual({ synopsis: 'synop', changelog: 'v1' });

    const b = new EditionAlmanac();
    await b.deserialize(data as Record<string, unknown>);
    expect(b.synopsis.get()).toBe('synop');
    expect(b.changelog.get()).toBe('v1');
    expect(b.overview.get()).toBe('');
  });
});
```

- [ ] **Step 3: `edition-meta.test.ts`**

Note the `saveDefault: true` on `name` — this is the interesting edge case.

```typescript
import { describe, it, expect } from 'vitest';
import { EditionMeta } from '../../../src/model/edition-meta';

describe('EditionMeta', () => {
  it('defaults: name = "New Edition", author = "", logo = null', () => {
    const m = new EditionMeta();
    expect(m.name.get()).toBe('New Edition');
    expect(m.author.get()).toBe('');
    expect(m.logo.get()).toBeNull();
  });

  it('serializes `name` even at default (saveDefault: true)', async () => {
    const m = new EditionMeta();
    await expect(m.serialize()).resolves.toEqual({ name: 'New Edition' });
  });

  it('omits `author` when at default but includes it when set', async () => {
    const m = new EditionMeta();
    await m.author.set('Tree');
    const out = await m.serialize();
    expect(out).toEqual({ name: 'New Edition', author: 'Tree' });
  });

  it('includes `logo` when set to a non-null string', async () => {
    const m = new EditionMeta();
    await m.logo.set('data:image/png;base64,AAA');
    const out = await m.serialize();
    expect(out).toMatchObject({ logo: 'data:image/png;base64,AAA' });
  });

  it('deserialize falls back to the default name when field is missing', async () => {
    const m = new EditionMeta();
    await m.name.set('Placeholder');
    await m.deserialize({ author: 'X' });
    expect(m.name.get()).toBe('Placeholder');
    expect(m.author.get()).toBe('X');
  });
});
```

> **Note for the implementer:** the final "deserialize falls back" test depends on how `ObservableObject.deserialize()` treats missing keys. If it resets missing properties to their defaults rather than leaving them as-is, rewrite the assertion to match observed behavior: read `src/bind/observable-object.ts:217-266` and adjust. If the observed behavior is different from both options, file a concern and match what the code actually does (tests document real behavior, not hoped-for behavior).

- [ ] **Step 4: `character-image-settings.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { CharacterImageSettings } from '../../../src/model/character-image-settings';

describe('CharacterImageSettings', () => {
  it('initializes all boolean defaults to true', () => {
    const s = new CharacterImageSettings();
    expect(s.shouldRestyle.get()).toBe(true);
    expect(s.shouldCrop.get()).toBe(true);
    expect(s.shouldColorize.get()).toBe(true);
    expect(s.useOutsiderAndMinionColors.get()).toBe(true);
    expect(s.useTexture.get()).toBe(true);
    expect(s.useBorder.get()).toBe(true);
    expect(s.useDropshadow.get()).toBe(true);
  });

  it('initializes numeric defaults', () => {
    const s = new CharacterImageSettings();
    expect(s.borderIntensity.get()).toBe(1);
    expect(s.dropShadowSize.get()).toBe(16);
    expect(s.dropShadowOffsetX.get()).toBe(0);
    expect(s.dropShadowOffsetY.get()).toBe(10);
    expect(s.dropShadowOpacity.get()).toBe(0.5);
  });

  it('serializes only non-default numeric changes', async () => {
    const s = new CharacterImageSettings();
    await s.dropShadowOpacity.set(0.25);
    await s.borderIntensity.set(2);
    const out = await s.serialize();
    expect(out).toEqual({ dropShadowOpacity: 0.25, borderIntensity: 2 });
  });

  it('round-trips a settings payload', async () => {
    const a = new CharacterImageSettings();
    await a.dropShadowSize.set(20);
    await a.useBorder.set(false);
    const data = await a.serialize();

    const b = new CharacterImageSettings();
    await b.deserialize(data as Record<string, unknown>);
    expect(b.dropShadowSize.get()).toBe(20);
    expect(b.useBorder.get()).toBe(false);
    expect(b.dropShadowOpacity.get()).toBe(0.5);
  });
});
```

- [ ] **Step 5: Run the full suite**

```bash
npm test
```
Expected: all four new test files plus prior tests pass. Zero failures.

- [ ] **Step 6: Commit (user runs)**

```bash
git add tests/unit/model/character-almanac.test.ts tests/unit/model/edition-almanac.test.ts tests/unit/model/edition-meta.test.ts tests/unit/model/character-image-settings.test.ts
git commit -m "Add unit tests for simple ObservableObject data containers"
```

---

## Task 5: Test pure exports of `src/validate.ts`

Four pure functions: `validateEmail`, `validatePassword`, `validateUsername`, `validateSaveName`. The four `updateXWarnings(...)` functions require `HTMLElement` — skip them. Note: `validate.ts` imports `createElement` from `./util`; the import is a reference only (not a call), so loading the module under Node is safe.

**Files:**
- Create: `tests/unit/validate.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateSaveName,
} from '../../src/validate';

describe('validateEmail', () => {
  it.each([
    'user@example.com',
    'first.last@sub.example.co.uk',
    'user+tag@example.com',
    'a@b.c',
  ])('accepts %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each([
    'plain',
    '@example.com',
    'user@',
    'user@.com',
    'user@example.',
    '',
    'two@@example.com',
  ])('rejects %s', (email) => {
    expect(validateEmail(email)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts short-but-complex passwords (≥8 chars, has lower, upper, digit)', () => {
    expect(validatePassword('Abcdef12')).toBe(true);
    expect(validatePassword('AAAA0000aaaa')).toBe(true);
  });

  it('rejects passwords shorter than 8', () => {
    expect(validatePassword('Ab12')).toBe(false);
    expect(validatePassword('')).toBe(false);
    expect(validatePassword('Abcdef1')).toBe(false); // exactly 7
  });

  it('at 8–23 chars, rejects missing lowercase / uppercase / digit', () => {
    expect(validatePassword('ABCDEFGH')).toBe(false); // no lower, no digit
    expect(validatePassword('abcdefgh')).toBe(false); // no upper, no digit
    expect(validatePassword('Abcdefgh')).toBe(false); // no digit
    expect(validatePassword('ABC12345')).toBe(false); // no lower
    expect(validatePassword('abc12345')).toBe(false); // no upper
  });

  it('accepts long passwords (≥24 chars) regardless of complexity', () => {
    expect(validatePassword('aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true); // 24 a's
    expect(validatePassword('a'.repeat(50))).toBe(true);
  });

  it('rejects a 23-char all-lowercase password (complexity still enforced)', () => {
    expect(validatePassword('a'.repeat(23))).toBe(false);
  });
});

describe('validateUsername / validateSaveName', () => {
  it('accepts letters, digits, hyphens, and underscores', () => {
    expect(validateUsername('abc')).toBe(true);
    expect(validateUsername('A1b2C3')).toBe(true);
    expect(validateUsername('my-name_2')).toBe(true);
    expect(validateSaveName('my-save_1')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateUsername('')).toBe(false);
    expect(validateSaveName('')).toBe(false);
  });

  it.each(['.', ' ', '/', '@', 'a b', 'a/b', 'user@host'])(
    'rejects "%s"',
    (s) => {
      expect(validateUsername(s)).toBe(false);
      expect(validateSaveName(s)).toBe(false);
    }
  );

  it('validateSaveName delegates to validateUsername (same rules)', () => {
    const inputs = ['abc', '', '!', 'a_b-c1'];
    for (const i of inputs) {
      expect(validateSaveName(i)).toBe(validateUsername(i));
    }
  });
});
```

- [ ] **Step 2: Run**

```bash
npm test
```
Expected: all pass. If `validateEmail` accepts or rejects something different than expected, the regex is the source of truth — update the test to match observed behavior and flag the surprise.

- [ ] **Step 3: Commit (user runs)**

```bash
git add tests/unit/validate.test.ts
git commit -m "Add unit tests for validate.ts pure validators"
```

---

## Task 6: Test pure exports of `src/util.ts`

Five pure helpers: `arrayGet`, `arrayGetLast`, `boundsCheck`, `isRecord`, `getOrdinalString`. The DOM/network functions (`createElement`, `fetchJson`, `hookupClickEvents`, `showHideElement`, `walkHTMLElements`) are OUT of scope — don't test them here.

**Files:**
- Create: `tests/unit/util.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  arrayGet,
  arrayGetLast,
  boundsCheck,
  isRecord,
  getOrdinalString,
} from '../../src/util';

describe('arrayGet', () => {
  it('returns the element at a valid index', () => {
    expect(arrayGet([10, 20, 30], 0, -1)).toBe(10);
    expect(arrayGet([10, 20, 30], 2, -1)).toBe(30);
  });

  it('returns the default for out-of-bounds indexes', () => {
    expect(arrayGet([10, 20, 30], 10, -1)).toBe(-1);
    expect(arrayGet([10, 20, 30], -1, 'fallback')).toBe('fallback');
    expect(arrayGet([], 0, null)).toBeNull();
  });
});

describe('arrayGetLast', () => {
  it('returns the last element of a non-empty array', () => {
    expect(arrayGetLast([1, 2, 3], -1)).toBe(3);
    expect(arrayGetLast(['a'], '-')).toBe('a');
  });

  it('returns the default for an empty array', () => {
    expect(arrayGetLast([], 99)).toBe(99);
  });
});

describe('boundsCheck', () => {
  it('returns true for valid non-negative integer indexes', () => {
    expect(boundsCheck(0, [10, 20, 30])).toBe(true);
    expect(boundsCheck(2, [10, 20, 30])).toBe(true);
  });

  it('returns false for out-of-range indexes', () => {
    expect(boundsCheck(3, [10, 20, 30])).toBe(false);
    expect(boundsCheck(-1, [10, 20, 30])).toBe(false);
  });

  it('returns false for non-number inputs', () => {
    expect(boundsCheck('0', [10, 20, 30])).toBe(false);
    expect(boundsCheck(null, [10, 20, 30])).toBe(false);
    expect(boundsCheck(undefined, [10, 20, 30])).toBe(false);
  });
});

describe('isRecord', () => {
  it('accepts plain objects and arrays', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([1, 2])).toBe(true);
  });

  it('rejects primitives and null', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe('getOrdinalString', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [101, '101st'],
    [111, '111th'],
    [112, '112th'],
    [113, '113th'],
  ])('getOrdinalString(%d) === %s', (n, expected) => {
    expect(getOrdinalString(n)).toBe(expected);
  });
});
```

> **Note for the implementer:** The `getOrdinalString` cases above assume the standard English-language ordinal rules (11, 12, 13 all use 'th' regardless of last digit). Verify by reading `src/util.ts`. If the implementation diverges, update the test cases to match observed behavior and flag the discrepancy — tests document reality.

- [ ] **Step 2: Run**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 3: Commit (user runs)**

```bash
git add tests/unit/util.test.ts
git commit -m "Add unit tests for util.ts pure helpers"
```

---

## Task 7: Test pure surface of `src/model/character.ts`

`Character` has lots of properties and an impure `asyncNew()` factory plus image-regeneration methods. Instantiate with `new Character()` (not the async factory) to avoid the DOM/canvas side effects. Test: defaults, a single property mutation, serialize shape, round-trip via raw `deserialize()`. Skip `asyncNew`, `regenerateStyledImage`, `_regenerateStyledImage`.

**Files:**
- Create: `tests/unit/model/character.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import { Character } from '../../../src/model/character';
import { BloodTeam } from '../../../src/model/blood-team';
import { BloodSpecial } from '../../../src/model/special';

describe('Character (pure surface only — skips asyncNew/image regen)', () => {
  it('raw `new Character()` populates documented defaults', () => {
    const c = new Character();
    expect(c.id.get()).toBe('newcharacter');
    expect(c.name.get()).toBe('New Character');
    expect(c.team.get()).toBe(BloodTeam.TOWNSFOLK);
    expect(c.special.get()).toBe(BloodSpecial.NONE);
    expect(c.ability.get()).toBe('');
    expect(c.export.get()).toBe(true);
    expect(c.setup.get()).toBe(false);
    expect(c.unStyledImage.get()).toBeNull();
    expect(c.styledImage.get()).toBeNull();
  });

  it('exposes child almanac and imageSettings objects', () => {
    const c = new Character();
    expect(c.almanac).toBeDefined();
    expect(c.almanac.flavor.get()).toBe('');
    expect(c.imageSettings).toBeDefined();
    expect(c.imageSettings.shouldRestyle.get()).toBe(true);
  });

  it('serializes the saveDefault fields even when untouched', async () => {
    const c = new Character();
    const out = await c.serialize();
    // id, name, team have saveDefault:true — must always appear.
    expect(out.id).toBe('newcharacter');
    expect(out.name).toBe('New Character');
    expect(out.team).toBe(BloodTeam.TOWNSFOLK);
  });

  it('includes `ability` only once it has been set', async () => {
    const c = new Character();
    expect((await c.serialize()).ability).toBeUndefined();
    await c.ability.set('You start knowing a good player.');
    const out = await c.serialize();
    expect(out.ability).toBe('You start knowing a good player.');
  });

  it('round-trips custom values via serialize + deserialize', async () => {
    const a = new Character();
    await a.name.set('Washerwoman');
    await a.id.set('washerwoman');
    await a.ability.set('You start knowing a Townsfolk.');
    await a.team.set(BloodTeam.TOWNSFOLK);
    await a.export.set(false);
    const data = await a.serialize();

    const b = new Character();
    await b.deserialize(data);
    expect(b.name.get()).toBe('Washerwoman');
    expect(b.id.get()).toBe('washerwoman');
    expect(b.ability.get()).toBe('You start knowing a Townsfolk.');
    expect(b.team.get()).toBe(BloodTeam.TOWNSFOLK);
    expect(b.export.get()).toBe(false);
  });
});
```

> **Note for the implementer:** Property names and defaults listed above are from a code audit. If any field name differs (e.g., `export` vs `shouldExport`), read `src/model/character.ts` top-to-bottom and adjust the test to match the actual property names. Do not modify `character.ts` to match the test — the source of truth is the existing source code.

- [ ] **Step 2: Run and verify**

```bash
npm test
```
Expected: all tests pass. If `new Character()` triggers a DOM or network call (it shouldn't, but `regenerateStyledImage` runs in the constructor on some classes — verify by reading the constructor first), flag it as BLOCKED before writing the test.

- [ ] **Step 3: Commit (user runs)**

```bash
git add tests/unit/model/character.test.ts
git commit -m "Add unit tests for Character model pure surface"
```

---

## Task 8: Test pure surface of `src/model/edition.ts`

Similar approach to `Character`: instantiate raw, test defaults and serialize shape. Also exercises `ObservableCollection` (characterList) and two custom-serialized collections (firstNightOrder / otherNightOrder, which store just character IDs). Skip `asyncNew`, `open`, `reset`, `addNewCharacter`.

**Files:**
- Create: `tests/unit/model/edition.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import { Edition } from '../../../src/model/edition';

describe('Edition (pure surface only — skips asyncNew / open / add)', () => {
  it('raw `new Edition()` populates defaults', () => {
    const e = new Edition();
    expect(e.windowTitle.get()).toBe('Bloodstar Clocktica');
    expect(e.saveName.get()).toBe('');
    expect(e.dirty.get()).toBe(false);
    expect(e.previewOnToken.get()).toBe(true);
  });

  it('exposes child meta and almanac objects with their defaults', () => {
    const e = new Edition();
    expect(e.meta).toBeDefined();
    expect(e.meta.name.get()).toBe('New Edition');
    expect(e.almanac).toBeDefined();
    expect(e.almanac.synopsis.get()).toBe('');
  });

  it('starts with empty characterList and night-order collections', () => {
    const e = new Edition();
    // ObservableCollection exposes .getItems() or .length — use whatever the class surface provides.
    // If neither exists, read observable-collection.ts and adjust.
    expect(e.characterList).toBeDefined();
    expect(e.firstNightOrder).toBeDefined();
    expect(e.otherNightOrder).toBeDefined();
  });

  it('serializes the empty edition to a minimal object with meta.name defaulted', async () => {
    const e = new Edition();
    const out = await e.serialize();
    expect(out.meta).toMatchObject({ name: 'New Edition' });
    expect(out.characterList).toEqual([]);
    expect(out.firstNightOrder).toEqual([]);
    expect(out.otherNightOrder).toEqual([]);
  });
});
```

> **Note for the implementer:** `Edition.characterList` is an `ObservableCollection<Character>`. Its public API (`.add()`, `.getItems()`, etc.) lives in `src/bind/observable-collection.ts`. Read that file before extending this test. If `new Edition()` does NOT give you a testable empty collection (e.g., if it requires `asyncNew` for the collection to initialize), stop here and flag it — that would be a YELLOW→RED reclassification. Don't guess; read.
>
> Also: if calling `serialize()` on a raw `new Edition()` throws (e.g., because some event-listener setup lives inside a non-async init path), mark this test file as BLOCKED and report. Better to skip than to test a happy-path that production code never hits.

- [ ] **Step 2: Run**

```bash
npm test
```
Expected: all tests pass, OR a specific failure that reveals a real behavior of `new Edition()` we need to accommodate (listed above).

- [ ] **Step 3: Commit (user runs)**

```bash
git add tests/unit/model/edition.test.ts
git commit -m "Add unit tests for Edition model pure surface"
```

---

## Task 9: Remove the smoke test now that real tests exist

`tests/unit/smoke.test.ts` served its purpose (proving Vitest + decorators worked). Its coverage is now fully subsumed by `edition-almanac.test.ts`. Delete it so the suite has one source of truth per module.

**Files:**
- Delete: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Remove the file**

```bash
git rm tests/unit/smoke.test.ts
```

- [ ] **Step 2: Re-run**

```bash
npm test
```
Expected: same number of `it` blocks as before minus the one smoke assertion. All pass.

- [ ] **Step 3: Commit (user runs)**

```bash
git commit -m "Remove smoke test superseded by model test suite"
```

---

## Task 10: End-to-end verification and CI check

Prove the whole Phase-2 delivery works locally and that CI will run it.

**Files:** none created; behavioral verification.

- [ ] **Step 1: Run the full Vitest suite**

```bash
npm test
```
Expected: every test file passes. Report the totals (test files, tests, assertions, duration). Target: all tests complete in under 3 seconds locally.

- [ ] **Step 2: Exercise the combined npm entrypoints**

```bash
npm run test:all
```
Expected: `test` runs Vitest → passes, `test:api` prints "API tests arrive in Phase 3 (Hurl)." → exit 0, `test:e2e` prints "E2E tests arrive in Phase 4 (Playwright)." → exit 0. Final exit 0.

- [ ] **Step 3: Spot-check `unit.yml`**

Open `.github/workflows/unit.yml` and confirm its final step is `run: npm test`. That already matches the placeholder — no workflow edit is needed. The change is transparent: `npm test` now invokes Vitest instead of `echo`.

- [ ] **Step 4: Push and verify CI on GitHub**

The user pushes the branch (or opens a PR). Check the Actions tab: the `Unit tests` workflow should run and pass.

- [ ] **Step 5: Tag (user runs, optional)**

```bash
git tag testing/phase-2-complete
```

---

## Acceptance criteria for Phase 2

All of the following must be true before starting Phase 3:

1. `npm test` runs Vitest and passes in under 3 s locally.
2. `tests/unit/` contains:
   - `model/blood-team.test.ts`
   - `model/special.test.ts`
   - `model/character-almanac.test.ts`
   - `model/edition-almanac.test.ts`
   - `model/edition-meta.test.ts`
   - `model/character-image-settings.test.ts`
   - `model/character.test.ts`
   - `model/edition.test.ts`
   - `validate.test.ts`
   - `util.test.ts`
3. `vitest.config.ts` exists at repo root with `experimentalDecorators: true` propagated to esbuild.
4. `package.json` has `test` pointing to `vitest run`, and Vitest in `devDependencies`.
5. `npm run test:all` still exits 0 (placeholders + real Vitest chain cleanly).
6. GitHub Actions `unit.yml` passes on the pushed branch.
7. No module outside the Phase-2 scope (state-history, team-color, recent-file) is modified or tested.
8. No production source file is modified — Phase 2 is purely additive.

## Out of scope for Phase 2 (reminder)

- `state-history.ts`, `team-color.ts`, `recent-file.ts` (RED trio — need a small refactor first, deferred to a separate phase or covered via Playwright in Phase 4+).
- Impure methods named in this plan (`asyncNew`, `regenerate*`, all `update*Warnings`, the DOM/network exports of `util.ts`).
- Any coverage-percentage gate.
- `jsdom` or `happy-dom` — unit tests stay pure-Node.
- Performance benchmarks.
