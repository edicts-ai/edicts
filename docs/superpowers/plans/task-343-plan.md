# Lifecycle Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement TTL lifecycle, universal auto-pruning, capacity warnings, auto-save, review surfacing, and agent-assisted compaction for the edict store.

**Architecture:** Extends existing `EdictStore` with new config options, makes all edict-touching public methods async (via async `_autoPrune()`), adds `capacityStatus()`, `review()`, and `compact()` methods, and introduces a `parseDuration()` utility for `expiresIn` support.

**Tech Stack:** TypeScript, vitest, tsup — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-20-lifecycle-management-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Add new types/interfaces, new fields on existing types |
| `src/duration.ts` | Create | `parseDuration()` utility |
| `src/schema.ts` | Modify | Validation for `expiresIn`, ephemeral default expiry |
| `src/store.ts` | Modify | Async methods, auto-save, capacity, review, compact |
| `src/errors.ts` | Modify | No changes needed (existing errors sufficient) |
| `src/index.ts` | Modify | Export new types and `parseDuration` |
| `src/cli.ts` | Modify | Remove explicit `save()`, add `--expiresIn` flag |
| `tests/duration.test.ts` | Create | Duration parsing tests |
| `tests/lifecycle.test.ts` | Create | Pruning-on-read, auto-save, capacity, review, compact tests |
| `tests/store.test.ts` | Modify | Update existing tests for async signatures |
| `tests/store-crud-api.test.ts` | Modify | Update for async signatures |
| `tests/supersession.test.ts` | Modify | Update for async signatures |
| `tests/concurrency.test.ts` | Modify | Update for async signatures |
| `tests/schema.test.ts` | Modify | Add `expiresIn` validation tests |

---

## Chunk 1: Types, Duration Parsing & Validation

### Task 1: Add new types to `src/types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing type compilation test**

Add a new file `tests/types-lifecycle.test.ts` that imports and uses the new types:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  EdictInput,
  EdictStoreOptions,
  MutationResult,
  CapacityStatus,
  CompactionGroup,
  ReviewOptions,
  ReviewResult,
} from '../src/types.js';

describe('Lifecycle types', () => {
  it('EdictInput accepts expiresIn as string', () => {
    const input: EdictInput = { text: 'test', category: 'cat', expiresIn: '2h' };
    expect(input.expiresIn).toBe('2h');
  });

  it('EdictInput accepts expiresIn as number', () => {
    const input: EdictInput = { text: 'test', category: 'cat', expiresIn: 3600 };
    expect(input.expiresIn).toBe(3600);
  });

  it('EdictStoreOptions accepts lifecycle config', () => {
    const opts: EdictStoreOptions = {
      staleThresholdDays: 90,
      categoryLimits: { product: 30 },
      defaultCategoryLimit: 50,
      defaultEphemeralTtlSeconds: 86400,
      autoSave: false,
    };
    expect(opts.staleThresholdDays).toBe(90);
  });

  it('MutationResult accepts warnings', () => {
    const result: MutationResult = {
      action: 'created',
      pruned: 0,
      warnings: ['Store at 85% capacity'],
    };
    expect(result.warnings).toHaveLength(1);
  });

  it('CapacityStatus has expected shape', () => {
    const status: CapacityStatus = {
      countUsage: 0.85,
      tokenUsage: 0.72,
      categories: { product: { count: 25, limit: 30, overLimit: false } },
      warnings: [],
    };
    expect(status.countUsage).toBe(0.85);
  });

  it('ReviewResult has expected shape', () => {
    const result: ReviewResult = {
      stale: [],
      expiringSoon: [],
      capacity: {
        countUsage: 0,
        tokenUsage: 0,
        categories: {},
        warnings: [],
      },
      compactionCandidates: [],
    };
    expect(result.stale).toHaveLength(0);
  });

  it('CompactionGroup has expected shape', () => {
    const group: CompactionGroup = {
      keyPrefix: 'product/v2',
      category: 'product',
      edicts: [],
    };
    expect(group.keyPrefix).toBe('product/v2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types-lifecycle.test.ts`
Expected: FAIL — types don't exist yet

- [ ] **Step 3: Add new types and fields to `src/types.ts`**

Add `expiresIn` to `EdictInput`:

```typescript
/** Duration until expiry. String: '30m', '2h', '7d'. Number or numeric string: seconds. */
expiresIn?: string | number;
```

Add `warnings` to `MutationResult`:

```typescript
/** Capacity/limit warnings (informational) */
warnings?: string[];
```

Add new fields to `EdictStoreOptions`:

```typescript
/** Days before a durable edict is considered stale. Default: 90 */
staleThresholdDays?: number;
/** Per-category soft limits. e.g., { product: 30, internal: 20 } */
categoryLimits?: Record<string, number>;
/** Default soft limit for categories not explicitly listed */
defaultCategoryLimit?: number;
/** Default TTL in seconds for ephemeral edicts with no explicit expiry. Default: 86400 (24h) */
defaultEphemeralTtlSeconds?: number;
/** Auto-save after mutations and prune operations. Default: true */
autoSave?: boolean;
```

Add new interfaces:

```typescript
export interface CapacityStatus {
  countUsage: number;
  tokenUsage: number;
  categories: Record<string, { count: number; limit?: number; overLimit: boolean }>;
  warnings: string[];
}

export interface CompactionGroup {
  keyPrefix: string;
  category: string;
  edicts: Edict[];
}

export interface ReviewOptions {
  expiryLookaheadDays?: number;
}

export interface ReviewResult {
  stale: Edict[];
  expiringSoon: Edict[];
  capacity: CapacityStatus;
  compactionCandidates: CompactionGroup[];
}
```

Add `staleThresholdDays`, `categoryLimits`, and `defaultEphemeralTtlSeconds` to `EdictFileSchema.config`:

```typescript
config: {
  maxEdicts: number;
  tokenBudget: number;
  categories: string[];
  staleThresholdDays?: number;
  categoryLimits?: Record<string, number>;
  defaultCategoryLimit?: number;
  defaultEphemeralTtlSeconds?: number;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/types-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/types-lifecycle.test.ts
git commit -m "feat(types): add lifecycle management types — CapacityStatus, ReviewResult, CompactionGroup, new EdictInput/Options fields"
```

---

### Task 2: Create `parseDuration()` utility

**Files:**
- Create: `src/duration.ts`
- Create: `tests/duration.test.ts`

- [ ] **Step 1: Write failing tests for `parseDuration()`**

```typescript
import { describe, it, expect } from 'vitest';
import { parseDuration } from '../src/duration.js';

describe('parseDuration', () => {
  it('parses minutes suffix', () => {
    expect(parseDuration('30m')).toBe(1800);
  });

  it('parses hours suffix', () => {
    expect(parseDuration('2h')).toBe(7200);
  });

  it('parses days suffix', () => {
    expect(parseDuration('7d')).toBe(604800);
  });

  it('accepts number directly (seconds)', () => {
    expect(parseDuration(3600)).toBe(3600);
  });

  it('accepts numeric string as seconds', () => {
    expect(parseDuration('86400')).toBe(86400);
  });

  it('accepts string "0" as zero seconds', () => {
    expect(parseDuration('0')).toBe(0);
  });

  it('accepts number 0 as zero seconds', () => {
    expect(parseDuration(0)).toBe(0);
  });

  it('handles whitespace in string', () => {
    expect(parseDuration(' 2h ')).toBe(7200);
  });

  it('handles uppercase suffix', () => {
    expect(parseDuration('2H')).toBe(7200);
  });

  it('throws on invalid suffix', () => {
    expect(() => parseDuration('5w')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => parseDuration('')).toThrow();
  });

  it('throws on negative number', () => {
    expect(() => parseDuration(-100)).toThrow();
  });

  it('throws on negative string duration', () => {
    expect(() => parseDuration('-2h')).toThrow();
  });

  it('throws on NaN', () => {
    expect(() => parseDuration(NaN)).toThrow();
  });

  it('throws on non-numeric non-suffixed string', () => {
    expect(() => parseDuration('abc')).toThrow();
  });

  it('parses 1m as 60 seconds', () => {
    expect(parseDuration('1m')).toBe(60);
  });

  it('parses 1d as 86400 seconds', () => {
    expect(parseDuration('1d')).toBe(86400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/duration.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `parseDuration()`**

Create `src/duration.ts`:

```typescript
import { EdictValidationError } from './errors.js';

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  m: 60,
  h: 3600,
  d: 86400,
};

/**
 * Parse a duration into seconds.
 * - number → seconds directly
 * - string of digits → seconds
 * - string with suffix (m/h/d) → converted to seconds
 */
export function parseDuration(value: string | number): number {
  if (typeof value === 'number') {
    if (isNaN(value) || value < 0) {
      throw new EdictValidationError(`Invalid duration: ${value}. Must be a non-negative number of seconds.`);
    }
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new EdictValidationError('Invalid duration: empty string');
  }

  // Pure numeric string → seconds
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Match number + suffix
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z])$/);
  if (!match) {
    throw new EdictValidationError(
      `Invalid duration "${value}". Use a number (seconds), or a string like '30m', '2h', '7d'.`
    );
  }

  const amount = parseFloat(match[1]);
  const suffix = match[2].toLowerCase();

  if (amount < 0) {
    throw new EdictValidationError(`Invalid duration: negative value "${value}"`);
  }

  const multiplier = SUFFIX_MULTIPLIERS[suffix];
  if (!multiplier) {
    throw new EdictValidationError(
      `Invalid duration suffix "${suffix}" in "${value}". Supported: m (minutes), h (hours), d (days).`
    );
  }

  return Math.round(amount * multiplier);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/duration.test.ts`
Expected: PASS — all 17 tests

- [ ] **Step 5: Commit**

```bash
git add src/duration.ts tests/duration.test.ts
git commit -m "feat(duration): add parseDuration() utility for expiresIn support"
```

---

### Task 3: Update validation for `expiresIn` and ephemeral defaults

**Files:**
- Modify: `src/schema.ts`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/schema.test.ts`:

```typescript
import { parseDuration } from '../src/duration.js';

describe('validateEdictInput — expiresIn', () => {
  it('rejects both expiresAt and expiresIn', () => {
    expect(() =>
      validateEdictInput({
        text: 'Test',
        category: 'test',
        expiresAt: '2026-04-01T00:00:00Z',
        expiresIn: '2h',
      })
    ).toThrow();
  });

  it('accepts expiresIn string', () => {
    expect(() =>
      validateEdictInput({ text: 'Test', category: 'test', expiresIn: '2h' })
    ).not.toThrow();
  });

  it('accepts expiresIn number', () => {
    expect(() =>
      validateEdictInput({ text: 'Test', category: 'test', expiresIn: 3600 })
    ).not.toThrow();
  });

  it('rejects invalid expiresIn', () => {
    expect(() =>
      validateEdictInput({ text: 'Test', category: 'test', expiresIn: 'banana' })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — validation doesn't check `expiresIn` yet

- [ ] **Step 3: Update `validateEdictInput()` in `src/schema.ts`**

Add after the existing `expiresAt` validation:

```typescript
if (input.expiresIn !== undefined && input.expiresAt !== undefined) {
  throw new EdictValidationError(
    'Cannot specify both expiresAt and expiresIn. Use one or the other.'
  );
}

if (input.expiresIn !== undefined) {
  // Validate it parses — parseDuration throws EdictValidationError on bad input
  parseDuration(input.expiresIn);
}
```

Add the import at top of `src/schema.ts`:

```typescript
import { parseDuration } from './duration.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS — all tests including new ones

- [ ] **Step 5: Commit**

```bash
git add src/schema.ts tests/schema.test.ts
git commit -m "feat(schema): validate expiresIn, reject expiresAt+expiresIn combo"
```

---

### Task 4: Export new types and `parseDuration` from `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update exports**

Add to the type exports in `src/index.ts`:

```typescript
export type {
  // ...existing exports...
  CapacityStatus,
  CompactionGroup,
  ReviewOptions,
  ReviewResult,
} from './types.js';
```

Add function export:

```typescript
export { parseDuration } from './duration.js';
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(index): export lifecycle types and parseDuration"
```

---

## Chunk 2: Async Methods, Auto-Save & Auto-Prune on Reads

### Task 5: Make `_autoPrune()` async with auto-save, update all calling methods

**Files:**
- Modify: `src/store.ts`

This is the largest single change. All public methods that call `_autoPrune()` become async.

- [ ] **Step 1: Update constructor to accept new options**

Add fields to the class:

```typescript
private readonly staleThresholdDays: number;
private readonly categoryLimits: Record<string, number> | undefined;
private readonly defaultCategoryLimit: number | undefined;
private readonly defaultEphemeralTtlSeconds: number;
private readonly autoSave: boolean;
```

Initialize in constructor:

```typescript
this.staleThresholdDays = opts.staleThresholdDays ?? 90;
this.categoryLimits = opts.categoryLimits;
this.defaultCategoryLimit = opts.defaultCategoryLimit;
this.defaultEphemeralTtlSeconds = opts.defaultEphemeralTtlSeconds ?? 86400;
this.autoSave = opts.autoSave ?? true;
```

- [ ] **Step 2: Make `_autoPrune()` async with auto-save**

```typescript
private async _autoPrune(): Promise<number> {
  const { active, expired } = pruneExpired(this._edicts);
  if (expired.length === 0) {
    return 0;
  }

  this._edicts = active;
  this._history = [...this._history, ...expired];
  this._dirty = true;
  if (this.autoSave) await this.save();
  return expired.length;
}
```

- [ ] **Step 3: Make `add()` async with `expiresIn` resolution and auto-save**

```typescript
async add(input: EdictInput): Promise<MutationResult> {
  const pruned = await this._autoPrune();
  validateEdictInput(input);

  const category = normalizeCategory(input.category);
  this._validateCategory(category);
  const tags = normalizeTags(input.tags ?? []);
  const now = new Date().toISOString();

  // Resolve expiresIn → expiresAt
  let expiresAt = input.expiresAt;
  if (input.expiresIn !== undefined) {
    const seconds = parseDuration(input.expiresIn);
    expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
  }

  // Default ephemeral TTL
  if (input.ttl === 'ephemeral' && !expiresAt) {
    expiresAt = new Date(Date.now() + this.defaultEphemeralTtlSeconds * 1000).toISOString();
  }

  // ... rest of existing add() logic, using expiresAt instead of input.expiresAt ...
  // ... (supersession check, count limit, budget check, push edict) ...

  // Generate capacity warnings
  const warnings = this._generateWarnings();

  const result: MutationResult = {
    action: /* 'created' or 'superseded' */,
    edict: structuredClone(edict),
    pruned,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  if (this.autoSave) await this.save();
  return result;
}
```

Import `parseDuration` at top of `store.ts`:

```typescript
import { parseDuration } from './duration.js';
```

- [ ] **Step 4: Make `remove()` async with auto-save**

```typescript
async remove(id: string): Promise<MutationResult> {
  const pruned = await this._autoPrune();
  const idx = this._edicts.findIndex((e) => e.id === id);
  if (idx === -1) return { action: 'not_found', found: false, id, pruned };
  const [removed] = this._edicts.splice(idx, 1);
  this._dirty = true;
  if (this.autoSave) await this.save();
  return { action: 'deleted', found: true, edict: structuredClone(removed), pruned };
}
```

- [ ] **Step 5: Make `update()` async with auto-save and warnings**

```typescript
async update(id: string, patch: Partial<EdictInput>): Promise<MutationResult> {
  const pruned = await this._autoPrune();
  // ... existing update logic ...
  this._dirty = true;

  const warnings = this._generateWarnings();
  const result: MutationResult = {
    action: 'updated',
    edict: structuredClone(edict),
    pruned,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  if (this.autoSave) await this.save();
  return result;
}
```

- [ ] **Step 6: Make read methods async**

`get()`:
```typescript
async get(id: string): Promise<Edict | undefined> {
  await this._autoPrune();
  const edict = this._edicts.find((e) => e.id === id);
  if (!edict) return undefined;
  edict.lastAccessed = new Date().toISOString();
  this._dirty = true;
  return structuredClone(edict);
}
```

`find()`:
```typescript
async find(predicate: ((e: Edict) => boolean) | FindQuery): Promise<Edict[]> {
  await this._autoPrune();
  // ... existing filter logic unchanged ...
}
```

`search()`:
```typescript
async search(query: string): Promise<Edict[]> {
  await this._autoPrune();
  // ... existing search logic unchanged ...
}
```

`all()`:
```typescript
async all(): Promise<Edict[]> {
  await this._autoPrune();
  return this._edicts.map((e) => structuredClone(e));
}
```

`render()`:
```typescript
async render(format?: 'plain' | 'markdown' | 'json'): Promise<string> {
  await this._autoPrune();
  // ... existing render logic unchanged ...
}
```

`stats()`:
```typescript
async stats(): Promise<EdictStats> {
  await this._autoPrune();
  // ... existing stats logic unchanged ...
}
```

- [ ] **Step 7: Update `_supersede()` to use resolved `expiresAt`**

The `_supersede()` method must also resolve `expiresIn` and apply ephemeral defaults. Pass the already-resolved `expiresAt` from `add()` into `_supersede()` instead of reading `input.expiresAt` directly.

Change `_supersede` signature to accept `expiresAt: string | undefined` as a parameter:

```typescript
private _supersede(
  existingIdx: number,
  input: EdictInput,
  category: string,
  tags: string[],
  now: string,
  expiresAt: string | undefined
): Edict {
  // ... existing logic, but use the expiresAt parameter instead of input.expiresAt ...
}
```

- [ ] **Step 8: Add `_generateWarnings()` private method**

```typescript
private _generateWarnings(): string[] {
  const warnings: string[] = [];
  const countUsage = this._edicts.length / this.maxEdicts;
  const tokenUsage = this.tokenCount() / this.tokenBudget;

  if (countUsage > 0.8) {
    warnings.push(
      `Store at ${Math.round(countUsage * 100)}% count capacity (${this._edicts.length}/${this.maxEdicts} edicts)`
    );
  }

  if (tokenUsage > 0.8) {
    warnings.push(
      `Store at ${Math.round(tokenUsage * 100)}% token capacity (${this.tokenCount()}/${this.tokenBudget} tokens)`
    );
  }

  // Per-category soft limit warnings
  const catCounts: Record<string, number> = {};
  for (const edict of this._edicts) {
    catCounts[edict.category] = (catCounts[edict.category] ?? 0) + 1;
  }

  for (const [cat, count] of Object.entries(catCounts)) {
    const limit = this.categoryLimits?.[cat] ?? this.defaultCategoryLimit;
    if (limit !== undefined && count > limit) {
      warnings.push(`Category '${cat}' has ${count} edicts (soft limit: ${limit})`);
    }
  }

  return warnings;
}
```

- [ ] **Step 9: Persist new config fields in `save()`**

Update the schema construction in `save()` to include new config fields:

```typescript
config: {
  maxEdicts: this._fileConfig.maxEdicts ?? this.maxEdicts,
  tokenBudget: this._fileConfig.tokenBudget ?? this.tokenBudget,
  categories: this._fileConfig.categories ?? this.categoryAllowlist ?? [],
  staleThresholdDays: this._fileConfig.staleThresholdDays ?? this.staleThresholdDays,
  categoryLimits: this._fileConfig.categoryLimits ?? this.categoryLimits,
  defaultCategoryLimit: this._fileConfig.defaultCategoryLimit ?? this.defaultCategoryLimit,
  defaultEphemeralTtlSeconds: this._fileConfig.defaultEphemeralTtlSeconds ?? this.defaultEphemeralTtlSeconds,
},
```

Same for `exportData()`.

Also update `load()` to read these fields from `_fileConfig`.

- [ ] **Step 10: Run full test suite**

Run: `npm test`
Expected: FAIL — existing tests call sync methods but now get Promises. This is expected and will be fixed in Task 6.

- [ ] **Step 11: Commit**

```bash
git add src/store.ts
git commit -m "feat(store): async methods, auto-save, expiresIn resolution, capacity warnings"
```

---

### Task 6: Update existing tests for async signatures

**Files:**
- Modify: `tests/store.test.ts`
- Modify: `tests/store-crud-api.test.ts`
- Modify: `tests/supersession.test.ts`
- Modify: `tests/concurrency.test.ts`

The core change: every call to `add()`, `remove()`, `update()`, `get()`, `find()`, `search()`, `all()`, `render()`, `stats()` must be `await`ed. All test functions calling these become `async`. All stores in tests use `autoSave: false` unless specifically testing persistence.

- [ ] **Step 1: Update `tests/store.test.ts`**

Key patterns to apply throughout:

1. Add `autoSave: false` to all `EdictStore` constructors:
   ```typescript
   const store = new EdictStore({ path, autoSave: false });
   ```

2. `await` all mutation and read calls:
   ```typescript
   // Before:
   store.add({ text: 'Test', category: 'test' });
   const edict = store.get('e_001');
   // After:
   await store.add({ text: 'Test', category: 'test' });
   const edict = await store.get('e_001');
   ```

3. For `expect(...).toThrow()` patterns, switch to `rejects`:
   ```typescript
   // Before:
   expect(() => store.add({ text: '', category: 'test' })).toThrow('text');
   // After:
   await expect(store.add({ text: '', category: 'test' })).rejects.toThrow('text');
   ```

4. Ensure all `it()` callbacks are `async`:
   ```typescript
   it('does thing', async () => { ... });
   ```

Apply these patterns to ALL tests in store.test.ts. Every `store.add()`, `store.remove()`, `store.update()`, `store.get()`, `store.find()`, `store.search()`, `store.all()`, `store.render()`, `store.stats()` call needs `await`.

- [ ] **Step 2: Update `tests/supersession.test.ts`**

Same patterns. Add `autoSave: false` to constructors, `await` all async method calls, use `rejects.toThrow()` for error assertions.

- [ ] **Step 3: Update `tests/concurrency.test.ts`**

Same patterns. These tests already use `await` for `save()`/`load()`, but mutation calls need `await` too.

- [ ] **Step 4: Update `tests/store-crud-api.test.ts`**

This file tests the CLI. The CLI calls `store.add()` which is now async — the CLI already `await`s the `main()` function, so the CLI itself should work. But check that the test expectations still hold. Add `autoSave: false` where the test creates stores directly.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: ALL 115+ tests pass

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add tests/store.test.ts tests/supersession.test.ts tests/concurrency.test.ts tests/store-crud-api.test.ts
git commit -m "refactor(tests): update all tests for async store methods, add autoSave: false"
```

---

## Chunk 3: Capacity Status, Review & Compaction

### Task 7: Implement `capacityStatus()` method

**Files:**
- Modify: `src/store.ts`
- Create: `tests/lifecycle.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lifecycle.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-lifecycle-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('capacityStatus', () => {
  it('returns zero usage for empty store', async () => {
    const store = new EdictStore({ path: join(tempDir, 'e.yaml'), autoSave: false });
    await store.load();
    const status = store.capacityStatus();
    expect(status.countUsage).toBe(0);
    expect(status.tokenUsage).toBe(0);
    expect(status.warnings).toHaveLength(0);
  });

  it('calculates count and token usage ratios', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      maxEdicts: 10,
      tokenBudget: 100,
      tokenizer: (t) => t.length,
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'a'.repeat(50), category: 'test' });
    const status = store.capacityStatus();
    expect(status.countUsage).toBe(0.1);
    expect(status.tokenUsage).toBe(0.5);
  });

  it('includes per-category breakdown', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      categoryLimits: { product: 2 },
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'A', category: 'product' });
    await store.add({ text: 'B', category: 'product' });
    await store.add({ text: 'C', category: 'product' });
    await store.add({ text: 'D', category: 'team' });

    const status = store.capacityStatus();
    expect(status.categories['product'].count).toBe(3);
    expect(status.categories['product'].limit).toBe(2);
    expect(status.categories['product'].overLimit).toBe(true);
    expect(status.categories['team'].overLimit).toBe(false);
  });

  it('uses defaultCategoryLimit for unlisted categories', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      defaultCategoryLimit: 1,
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'A', category: 'misc' });
    await store.add({ text: 'B', category: 'misc' });

    const status = store.capacityStatus();
    expect(status.categories['misc'].limit).toBe(1);
    expect(status.categories['misc'].overLimit).toBe(true);
  });

  it('generates warnings at >80% capacity', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      maxEdicts: 5,
      tokenBudget: 1000,
      autoSave: false,
    });
    await store.load();
    for (let i = 0; i < 5; i++) {
      await store.add({ text: `Edict ${i}`, category: 'test' });
    }

    const status = store.capacityStatus();
    expect(status.countUsage).toBe(1.0);
    expect(status.warnings.some((w) => w.includes('count capacity'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: FAIL — `capacityStatus` doesn't exist

- [ ] **Step 3: Implement `capacityStatus()`**

Add to `EdictStore`:

```typescript
capacityStatus(): CapacityStatus {
  const countUsage = this.maxEdicts > 0 ? this._edicts.length / this.maxEdicts : 0;
  const tokenUsage = this.tokenBudget > 0 ? this.tokenCount() / this.tokenBudget : 0;

  const catCounts: Record<string, number> = {};
  for (const edict of this._edicts) {
    catCounts[edict.category] = (catCounts[edict.category] ?? 0) + 1;
  }

  const categories: CapacityStatus['categories'] = {};
  for (const [cat, count] of Object.entries(catCounts)) {
    const limit = this.categoryLimits?.[cat] ?? this.defaultCategoryLimit;
    categories[cat] = {
      count,
      limit,
      overLimit: limit !== undefined ? count > limit : false,
    };
  }

  const warnings = this._generateWarnings();

  return structuredClone({ countUsage, tokenUsage, categories, warnings });
}
```

Import `CapacityStatus` type at top of store.ts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store.ts tests/lifecycle.test.ts
git commit -m "feat(store): add capacityStatus() method with per-category breakdown"
```

---

### Task 8: Add mutation warning tests

**Files:**
- Modify: `tests/lifecycle.test.ts`

- [ ] **Step 1: Write tests for warnings on `add()` and `update()`**

Append to `tests/lifecycle.test.ts`:

```typescript
describe('mutation warnings', () => {
  it('add returns warnings when count exceeds 80%', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      maxEdicts: 5,
      tokenBudget: 10000,
      autoSave: false,
    });
    await store.load();
    // Add 4 (80%) — should not warn yet
    for (let i = 0; i < 4; i++) {
      await store.add({ text: `E${i}`, category: 'test' });
    }
    // Add 5th (100%) — should warn
    const result = await store.add({ text: 'E4', category: 'test' });
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes('count capacity'))).toBe(true);
  });

  it('add returns warnings when token budget exceeds 80%', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      tokenBudget: 20,
      tokenizer: (t) => t.length,
      autoSave: false,
    });
    await store.load();
    const result = await store.add({ text: 'a'.repeat(17), category: 'test' });
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes('token capacity'))).toBe(true);
  });

  it('add returns category soft limit warning', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      categoryLimits: { product: 2 },
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'A', category: 'product' });
    await store.add({ text: 'B', category: 'product' });
    const result = await store.add({ text: 'C', category: 'product' });
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes("'product'"))).toBe(true);
  });

  it('add returns no warnings when under thresholds', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    const result = await store.add({ text: 'Hello', category: 'test' });
    expect(result.warnings).toBeUndefined();
  });

  it('update returns capacity warnings', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      maxEdicts: 5,
      tokenBudget: 10000,
      autoSave: false,
    });
    await store.load();
    for (let i = 0; i < 5; i++) {
      await store.add({ text: `E${i}`, category: 'test' });
    }
    const result = await store.update('e_001', { text: 'Updated' });
    expect(result.warnings).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/lifecycle.test.ts
git commit -m "test(lifecycle): add mutation warning tests"
```

---

### Task 9: Implement `review()` method

**Files:**
- Modify: `src/store.ts`
- Modify: `tests/lifecycle.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/lifecycle.test.ts`:

```typescript
describe('review', () => {
  it('identifies stale durable edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      staleThresholdDays: 30,
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Old fact', category: 'test', ttl: 'durable' });

    // Manually backdate lastAccessed and created
    const edicts = await store.all();
    const internal = (store as any)._edicts[0];
    internal.lastAccessed = '2025-01-01T00:00:00Z';
    internal.created = '2025-01-01T00:00:00Z';

    const result = store.review();
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].id).toBe('e_001');
  });

  it('does not flag recently accessed durable edicts as stale', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      staleThresholdDays: 30,
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Fresh fact', category: 'test', ttl: 'durable' });
    await store.get('e_001'); // updates lastAccessed

    const result = store.review();
    expect(result.stale).toHaveLength(0);
  });

  it('does not flag non-durable edicts as stale', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      staleThresholdDays: 30,
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Ephemeral', category: 'test', ttl: 'ephemeral', expiresIn: '7d' });

    const internal = (store as any)._edicts[0];
    internal.lastAccessed = '2025-01-01T00:00:00Z';

    const result = store.review();
    expect(result.stale).toHaveLength(0);
  });

  it('uses created timestamp as fallback when lastAccessed is undefined', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      staleThresholdDays: 30,
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Never accessed', category: 'test', ttl: 'durable' });

    const internal = (store as any)._edicts[0];
    internal.created = '2025-01-01T00:00:00Z';
    delete internal.lastAccessed;

    const result = store.review();
    expect(result.stale).toHaveLength(1);
  });

  it('identifies edicts expiring soon', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    // Expiring in 3 days (within default 7-day lookahead)
    const soon = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    await store.add({ text: 'Soon', category: 'test', ttl: 'event', expiresAt: soon });

    // Expiring in 30 days (outside lookahead)
    const later = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    await store.add({ text: 'Later', category: 'test', ttl: 'event', expiresAt: later });

    const result = store.review();
    expect(result.expiringSoon).toHaveLength(1);
    expect(result.expiringSoon[0].text).toBe('Soon');
  });

  it('respects custom expiryLookaheadDays', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    const in15 = new Date(Date.now() + 15 * 86400 * 1000).toISOString();
    await store.add({ text: 'In 15 days', category: 'test', ttl: 'event', expiresAt: in15 });

    expect(store.review().expiringSoon).toHaveLength(0);
    expect(store.review({ expiryLookaheadDays: 20 }).expiringSoon).toHaveLength(1);
  });

  it('includes capacity status', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    const result = store.review();
    expect(result.capacity).toBeDefined();
    expect(result.capacity.countUsage).toBe(0);
  });

  it('identifies compaction candidates by key prefix', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'V2 feature A', category: 'product', key: 'product/v2/feature-a' });
    await store.add({ text: 'V2 feature B', category: 'product', key: 'product/v2/feature-b' });
    await store.add({ text: 'V3 note', category: 'product', key: 'product/v3/note' });
    await store.add({ text: 'Unrelated', category: 'team', key: 'team/hiring' });

    const result = store.review();
    expect(result.compactionCandidates.length).toBeGreaterThanOrEqual(1);
    const v2Group = result.compactionCandidates.find((g) => g.keyPrefix === 'product/v2');
    expect(v2Group).toBeDefined();
    expect(v2Group!.edicts).toHaveLength(2);
  });

  it('excludes keyless edicts from compaction', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'No key 1', category: 'test' });
    await store.add({ text: 'No key 2', category: 'test' });

    const result = store.review();
    expect(result.compactionCandidates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: FAIL — `review()` doesn't exist

- [ ] **Step 3: Implement `review()` method**

Add to `EdictStore`:

```typescript
review(options?: ReviewOptions): ReviewResult {
  const now = Date.now();
  const staleThresholdMs = this.staleThresholdDays * 86400 * 1000;
  const lookaheadMs = (options?.expiryLookaheadDays ?? 7) * 86400 * 1000;

  // Stale durable edicts
  const stale = this._edicts
    .filter((e) => {
      if (e.ttl !== 'durable') return false;
      const accessedAt = e.lastAccessed ?? e.created;
      return now - new Date(accessedAt).getTime() > staleThresholdMs;
    })
    .map((e) => structuredClone(e));

  // Expiring soon
  const expiringSoon = this._edicts
    .filter((e) => {
      if (!e.expiresAt) return false;
      const expiresMs = new Date(e.expiresAt).getTime();
      const remaining = expiresMs - now;
      return remaining > 0 && remaining <= lookaheadMs;
    })
    .map((e) => structuredClone(e));

  // Capacity
  const capacity = this.capacityStatus();

  // Compaction candidates
  const compactionCandidates = this._findCompactionCandidates();

  return structuredClone({ stale, expiringSoon, capacity, compactionCandidates });
}
```

Add private helper for compaction candidate detection:

```typescript
private _findCompactionCandidates(): CompactionGroup[] {
  // Group keyed edicts by category + key prefix
  const groups = new Map<string, Edict[]>();

  for (const edict of this._edicts) {
    if (!edict.key) continue;

    // Extract prefix: everything before the last separator
    const separatorIdx = Math.max(
      edict.key.lastIndexOf('/'),
      edict.key.lastIndexOf('.'),
      edict.key.lastIndexOf('-')
    );
    if (separatorIdx <= 0) continue; // No meaningful prefix

    const prefix = edict.key.slice(0, separatorIdx);
    const groupKey = `${edict.category}::${prefix}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(edict);
  }

  // Only return groups with 2+ edicts
  const candidates: CompactionGroup[] = [];
  for (const [groupKey, edicts] of groups) {
    if (edicts.length < 2) continue;
    const [category, keyPrefix] = groupKey.split('::');
    candidates.push({
      keyPrefix,
      category,
      edicts: edicts.map((e) => structuredClone(e)),
    });
  }

  return candidates;
}
```

Import `ReviewOptions`, `ReviewResult`, `CompactionGroup` types.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store.ts tests/lifecycle.test.ts
git commit -m "feat(store): add review() method with stale detection, expiry lookahead, compaction candidates"
```

---

### Task 10: Implement `compact()` method

**Files:**
- Modify: `src/store.ts`
- Modify: `tests/lifecycle.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/lifecycle.test.ts`:

```typescript
describe('compact', () => {
  it('replaces group edicts with merged edict', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Feature A', category: 'product', key: 'product/v2/a' });
    await store.add({ text: 'Feature B', category: 'product', key: 'product/v2/b' });

    const review = store.review();
    const group = review.compactionCandidates.find((g) => g.keyPrefix === 'product/v2');
    expect(group).toBeDefined();

    const result = await store.compact(group!, {
      text: 'V2: Features A and B',
      category: 'product',
      key: 'product/v2/summary',
    });

    expect(result.action).toBe('created');
    const all = await store.all();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('V2: Features A and B');
  });

  it('moves replaced edicts to history', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'A', category: 'product', key: 'product/v2/a' });
    await store.add({ text: 'B', category: 'product', key: 'product/v2/b' });

    const review = store.review();
    const group = review.compactionCandidates[0];
    await store.compact(group, {
      text: 'Merged',
      category: 'product',
      key: 'product/v2/merged',
    });

    const history = store.history();
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history.some((h) => h.text === 'A')).toBe(true);
    expect(history.some((h) => h.text === 'B')).toBe(true);
  });

  it('rolls back on budget failure', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      tokenBudget: 30,
      tokenizer: (t) => t.length,
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Short A', category: 'product', key: 'product/v2/a' });
    await store.add({ text: 'Short B', category: 'product', key: 'product/v2/b' });

    const review = store.review();
    const group = review.compactionCandidates[0];

    await expect(
      store.compact(group, {
        text: 'a'.repeat(100), // Way over budget
        category: 'product',
        key: 'product/v2/merged',
      })
    ).rejects.toThrow('budget');

    // Originals should still be there
    const all = await store.all();
    expect(all).toHaveLength(2);
    expect(all[0].text).toBe('Short A');
  });

  it('auto-saves when autoSave is true', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: true,
    });
    await store.load();
    await store.add({ text: 'A', category: 'product', key: 'product/v2/a' });
    await store.add({ text: 'B', category: 'product', key: 'product/v2/b' });

    const review = store.review();
    const group = review.compactionCandidates[0];
    await store.compact(group, {
      text: 'Merged',
      category: 'product',
      key: 'product/v2/merged',
    });

    // Reload and verify persisted
    const store2 = new EdictStore({ path: join(tempDir, 'e.yaml'), autoSave: false });
    await store2.load();
    const all = await store2.all();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('Merged');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: FAIL — `compact()` doesn't exist

- [ ] **Step 3: Implement `compact()` method**

Add to `EdictStore`:

```typescript
async compact(group: CompactionGroup, merged: EdictInput): Promise<MutationResult> {
  // Snapshot state for rollback
  const edictSnapshot = this._edicts.map((e) => ({ ...e }));
  const historySnapshot = [...this._history];
  const dirtySnapshot = this._dirty;

  try {
    // Remove all edicts in the group
    const now = new Date().toISOString();
    for (const groupEdict of group.edicts) {
      const idx = this._edicts.findIndex((e) => e.id === groupEdict.id);
      if (idx !== -1) {
        const [removed] = this._edicts.splice(idx, 1);
        this._history.push({
          id: `${removed.id}__${now.replace(/[-:.TZ]/g, '')}_compacted`,
          text: removed.text,
          supersededBy: 'compacted',
          archivedAt: now,
        });
      }
    }
    this._dirty = true;

    // Add the merged edict (uses internal sync logic, not the public async add)
    validateEdictInput(merged);
    const category = normalizeCategory(merged.category);
    this._validateCategory(category);
    const tags = normalizeTags(merged.tags ?? []);

    let expiresAt = merged.expiresAt;
    if (merged.expiresIn !== undefined) {
      const seconds = parseDuration(merged.expiresIn);
      expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
    }
    if (merged.ttl === 'ephemeral' && !expiresAt) {
      expiresAt = new Date(Date.now() + this.defaultEphemeralTtlSeconds * 1000).toISOString();
    }

    const id = merged.key ?? this._nextSequentialId();
    const edict: Edict = {
      id,
      text: merged.text,
      category,
      tags,
      confidence: merged.confidence ?? 'user',
      source: merged.source ?? '',
      key: merged.key,
      ttl: merged.ttl ?? 'durable',
      expiresAt,
      created: now,
      updated: now,
      _tokens: this.tokenizer(merged.text),
    };

    const newTotal = this.tokenCount() + (edict._tokens ?? 0);
    if (newTotal > this.tokenBudget) {
      throw new EdictBudgetExceededError(this.tokenBudget, newTotal);
    }

    if (this._edicts.length >= this.maxEdicts) {
      throw new EdictCountLimitError(this.maxEdicts, this._edicts.length);
    }

    this._edicts.push(edict);
    this._dirty = true;

    const warnings = this._generateWarnings();
    if (this.autoSave) await this.save();

    return {
      action: 'created',
      edict: structuredClone(edict),
      pruned: 0,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    // Rollback
    this._edicts = edictSnapshot;
    this._history = historySnapshot;
    this._dirty = dirtySnapshot;
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store.ts tests/lifecycle.test.ts
git commit -m "feat(store): add compact() method with atomic rollback"
```

---

## Chunk 4: Auto-Prune on Reads, Auto-Save Integration & CLI

### Task 11: Test pruning on read methods

**Files:**
- Modify: `tests/lifecycle.test.ts`

- [ ] **Step 1: Write tests for pruning on reads**

Append to `tests/lifecycle.test.ts`:

```typescript
describe('pruning on reads', () => {
  it('get() prunes expired edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    await store.add({
      text: 'Expired',
      category: 'test',
      ttl: 'ephemeral',
      expiresAt: '2020-01-01T00:00:00Z',
      key: 'expired-key',
    });
    await store.add({ text: 'Active', category: 'test', key: 'active-key' });

    // Manually re-insert expired edict (load already pruned it, so we trick it)
    (store as any)._edicts.unshift({
      id: 'expired-manual',
      text: 'Should be pruned',
      category: 'test',
      tags: [],
      confidence: 'user',
      source: '',
      ttl: 'ephemeral',
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 5,
    });

    const result = await store.get('active-key');
    expect(result?.text).toBe('Active');

    // Expired edict should have been pruned
    const all = await store.all();
    expect(all.every((e) => e.id !== 'expired-manual')).toBe(true);
  });

  it('find() prunes expired edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Active', category: 'test' });

    (store as any)._edicts.push({
      id: 'expired-find',
      text: 'Expired',
      category: 'test',
      tags: [],
      confidence: 'user',
      source: '',
      ttl: 'ephemeral',
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 5,
    });

    const results = await store.find({ category: 'test' });
    expect(results.every((e) => e.id !== 'expired-find')).toBe(true);
  });

  it('all() prunes expired edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    (store as any)._edicts.push({
      id: 'expired-all',
      text: 'Expired',
      category: 'test',
      tags: [],
      confidence: 'user',
      source: '',
      ttl: 'ephemeral',
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 5,
    });

    const results = await store.all();
    expect(results).toHaveLength(0);
    expect(store.history().some((h) => h.id.startsWith('expired-all'))).toBe(true);
  });

  it('stats() prunes expired edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();
    await store.add({ text: 'Active', category: 'test' });

    (store as any)._edicts.push({
      id: 'expired-stats',
      text: 'Expired',
      category: 'test',
      tags: [],
      confidence: 'user',
      source: '',
      ttl: 'ephemeral',
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 5,
    });

    const stats = await store.stats();
    expect(stats.total).toBe(1);
  });

  it('search() prunes expired edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    (store as any)._edicts.push({
      id: 'expired-search',
      text: 'Expired searchable',
      category: 'test',
      tags: [],
      confidence: 'user',
      source: '',
      ttl: 'ephemeral',
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 5,
    });

    const results = await store.search('searchable');
    expect(results).toHaveLength(0);
  });

  it('render() prunes expired edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    (store as any)._edicts.push({
      id: 'expired-render',
      text: 'Expired render',
      category: 'test',
      tags: [],
      confidence: 'user',
      source: '',
      ttl: 'ephemeral',
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 5,
    });

    const output = await store.render('plain');
    expect(output).not.toContain('Expired render');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: PASS (pruning on reads was implemented in Task 5)

- [ ] **Step 3: Commit**

```bash
git add tests/lifecycle.test.ts
git commit -m "test(lifecycle): verify pruning on all read methods"
```

---

### Task 12: Test auto-save integration

**Files:**
- Modify: `tests/lifecycle.test.ts`

- [ ] **Step 1: Write auto-save tests**

Append to `tests/lifecycle.test.ts`:

```typescript
describe('auto-save', () => {
  it('add() persists automatically when autoSave is true', async () => {
    const path = join(tempDir, 'e.yaml');
    const store = new EdictStore({ path, autoSave: true });
    await store.load();
    await store.add({ text: 'Auto-saved', category: 'test' });

    // Reload and verify
    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    const all = await store2.all();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('Auto-saved');
  });

  it('remove() persists automatically when autoSave is true', async () => {
    const path = join(tempDir, 'e.yaml');
    const store = new EdictStore({ path, autoSave: true });
    await store.load();
    await store.add({ text: 'To remove', category: 'test' });
    await store.remove('e_001');

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    expect((await store2.all())).toHaveLength(0);
  });

  it('update() persists automatically when autoSave is true', async () => {
    const path = join(tempDir, 'e.yaml');
    const store = new EdictStore({ path, autoSave: true });
    await store.load();
    await store.add({ text: 'Original', category: 'test' });
    await store.update('e_001', { text: 'Updated' });

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    expect((await store2.get('e_001'))?.text).toBe('Updated');
  });

  it('does not auto-save when autoSave is false', async () => {
    const path = join(tempDir, 'e.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Not persisted', category: 'test' });

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    expect((await store2.all())).toHaveLength(0);
  });

  it('auto-prune persists when autoSave is true', async () => {
    const path = join(tempDir, 'e.yaml');
    const store = new EdictStore({ path, autoSave: true });
    await store.load();
    await store.add({ text: 'Active', category: 'test' });

    // Inject an expired edict
    (store as any)._edicts.push({
      id: 'will-expire',
      text: 'Expired',
      category: 'test',
      tags: [],
      confidence: 'user' as const,
      source: '',
      ttl: 'ephemeral' as const,
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 5,
    });
    // Reset hash so save works
    (store as any)._fileHash = await (store as any).storage.hash();

    // Trigger a read — prune should auto-save
    await store.all();

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    const all = await store2.all();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('Active');
    expect(store2.history().some((h) => h.id.startsWith('will-expire'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/lifecycle.test.ts
git commit -m "test(lifecycle): verify auto-save on mutations and prune"
```

---

### Task 13: Test `expiresIn` and ephemeral default behavior

**Files:**
- Modify: `tests/lifecycle.test.ts`

- [ ] **Step 1: Write expiresIn integration tests**

Append to `tests/lifecycle.test.ts`:

```typescript
describe('expiresIn resolution', () => {
  it('resolves expiresIn string to expiresAt on add', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    const before = Date.now();
    await store.add({ text: 'Temp', category: 'test', ttl: 'ephemeral', expiresIn: '2h' });
    const after = Date.now();

    const edict = await store.get('e_001');
    expect(edict?.expiresAt).toBeDefined();
    const expiresMs = new Date(edict!.expiresAt!).getTime();
    // Should be ~2 hours from now
    expect(expiresMs).toBeGreaterThanOrEqual(before + 7200 * 1000 - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 7200 * 1000 + 1000);
  });

  it('resolves expiresIn number to expiresAt on add', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    await store.add({ text: 'Temp', category: 'test', expiresIn: 3600 });
    const edict = await store.get('e_001');
    expect(edict?.expiresAt).toBeDefined();
  });

  it('rejects both expiresAt and expiresIn', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    await expect(
      store.add({
        text: 'Bad',
        category: 'test',
        expiresAt: '2026-12-01T00:00:00Z',
        expiresIn: '2h',
      })
    ).rejects.toThrow('both');
  });

  it('assigns default expiry to ephemeral edicts without expiresAt or expiresIn', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      defaultEphemeralTtlSeconds: 7200, // 2 hours
      autoSave: false,
    });
    await store.load();

    const before = Date.now();
    await store.add({ text: 'Ephemeral no expiry', category: 'test', ttl: 'ephemeral' });
    const after = Date.now();

    const edict = await store.get('e_001');
    expect(edict?.expiresAt).toBeDefined();
    const expiresMs = new Date(edict!.expiresAt!).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 7200 * 1000 - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 7200 * 1000 + 1000);
  });

  it('does not assign default expiry to non-ephemeral edicts', async () => {
    const store = new EdictStore({
      path: join(tempDir, 'e.yaml'),
      autoSave: false,
    });
    await store.load();

    await store.add({ text: 'Durable', category: 'test', ttl: 'durable' });
    const edict = await store.get('e_001');
    expect(edict?.expiresAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/lifecycle.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/lifecycle.test.ts
git commit -m "test(lifecycle): verify expiresIn resolution and ephemeral defaults"
```

---

### Task 14: Update CLI for auto-save and `--expiresIn`

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Update CLI**

Changes to `src/cli.ts`:

1. Remove the explicit `await store.save()` after `store.add()` — auto-save handles it.
2. Add `--expiresIn` flag parsing.
3. Since `list` calls `store.render()` which is now async, add `await`.
4. Since `stats` calls `store.stats()` which is now async, add `await`.

```typescript
case 'add': {
  const text = takeFlag(args, '--text');
  const category = takeFlag(args, '--category');
  const key = takeFlag(args, '--key');
  const source = takeFlag(args, '--source');
  const confidence = takeFlag(args, '--confidence') as 'verified' | 'inferred' | 'user' | undefined;
  const ttl = takeFlag(args, '--ttl') as 'ephemeral' | 'event' | 'durable' | 'permanent' | undefined;
  const expiresAt = takeFlag(args, '--expiresAt');
  const expiresIn = takeFlag(args, '--expiresIn');
  const tags = takeFlag(args, '--tags')?.split(',').map((v) => v.trim()).filter(Boolean);

  if (!text || !category) {
    throw new Error('add requires --text and --category');
  }

  const result = await store.add({ text, category, key, source, confidence, ttl, expiresAt, expiresIn, tags });
  // No explicit save() — autoSave handles it
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  break;
}
case 'list': {
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${await store.render('json')}\n`);
  } else {
    process.stdout.write(`${await store.render('plain')}\n`);
  }
  break;
}
case 'stats': {
  process.stdout.write(`${JSON.stringify(await store.stats(), null, 2)}\n`);
  break;
}
```

- [ ] **Step 2: Run full test suite (including CLI tests)**

Run: `npm test`
Expected: ALL tests pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): remove explicit save (auto-save), add --expiresIn flag, await async methods"
```

---

## Chunk 5: Final Verification

### Task 15: Full verification pass

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: ALL tests pass (115+ original + ~50 new = 165+ total)

- [ ] **Step 2: Run type check**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build producing `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`

- [ ] **Step 4: Verify exports**

Run: `node -e "const m = require('./dist/index.cjs'); console.log(Object.keys(m).sort().join(', '))"`
Expected: Output includes `EdictStore`, `parseDuration`, plus all type names from index.ts

- [ ] **Step 5: Verify CLI**

```bash
node dist/cli.js --path /tmp/test-edicts.yaml add --text "Test edict" --category "test" --expiresIn "2h" --ttl ephemeral
node dist/cli.js --path /tmp/test-edicts.yaml list
node dist/cli.js --path /tmp/test-edicts.yaml stats
rm /tmp/test-edicts.yaml
```

Expected: Edict created with `expiresAt` set ~2h in the future, list shows it, stats show it.

- [ ] **Step 6: Final commit**

```bash
git add -A
git status  # Verify no unexpected files
git commit -m "feat: lifecycle management — TTL, expiry, pruning, auto-save, review, compaction (#343)"
```
