# Task #345 — Implementation Plan

> Plan for: Test Suite & Validation for Edicts Engine  
> Design spec: `docs/superpowers/specs/task-345-design.md`  
> Created: 2026-03-21

---

## Phase 1: Edicts Core — Corruption Recovery Tests

**File:** `tests/corruption.test.ts`

### Step 1.1: Create corruption test file with malformed YAML tests

Create `tests/corruption.test.ts` with the standard temp-dir setup pattern. Implement tests for:

- Completely invalid YAML (`}{{{not yaml`) — `store.load()` should throw
- Empty file (0 bytes) — `store.load()` should handle gracefully (empty store or throw)
- Valid YAML but wrong root shape (array at root, string at root)
- Missing `version` field — should throw
- Unsupported version number (version: 99) — should throw
- Missing `edicts` array — should warn and initialize empty
- Missing `config` section — should warn and use defaults
- Missing `history` array — should warn and initialize empty

**References:**
- Pattern: `tests/store.test.ts` (lines 1-20 for setup, lines 45-72 for load-from-file pattern)
- Validation logic: `src/schema.ts` → `validateFileSchema()`
- Store load: `src/store.ts` → `load()` method

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/corruption.test.ts
```

### Step 1.2: Add edict-level corruption tests

Add tests within `tests/corruption.test.ts` for corrupted edict entries in otherwise valid files:

- Edict with empty text (should warn/skip or error)
- Edict with number for text field (wrong type)
- Edict with array for category field (wrong type)
- Edict with invalid `confidence` enum value (e.g., `"maybe"`)
- Edict with invalid `ttl` enum value (e.g., `"forever"`)
- Edict with non-ISO-8601 `expiresAt` string
- Edict with non-ISO-8601 `created`/`updated` timestamps
- Corrupt history entries (missing fields, wrong types)

**References:**
- Schema validation: `src/schema.ts` → `validateFileSchema()` warning generation
- How store handles warnings: `src/store.ts` → `loadWarnings` property

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/corruption.test.ts
```

### Step 1.3: Add format mismatch and encoding tests

Add tests for:

- Valid JSON content in a `.yaml` file (format mismatch)
- JSON file with trailing garbage after the closing brace
- YAML file with BOM (byte order mark — `\uFEFF` prefix)
- Truncated YAML (valid prefix, cut mid-edict — simulate partial write)

**References:**
- Storage layer: `src/storage/yaml.ts`, `src/storage/json.ts`
- Atomic write pattern: `src/storage/base.ts`

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/corruption.test.ts
```

---

## Phase 2: Edicts Core — Edge Case Tests

**File:** `tests/edge-cases.test.ts`

### Step 2.1: Create edge-cases file with Unicode and special character tests

Create `tests/edge-cases.test.ts`. Implement tests for:

- Edict with emoji text (🎯🚀) — add, retrieve, render, search
- Edict with CJK characters (中文测试)
- Edict with RTL text (مرحبا)
- Unicode in keys (emoji key, CJK key)
- Unicode in tags
- Unicode in categories
- Keys with dots (`config.database.host`)
- Keys with spaces (`my key name`)
- Keys with colons and equals (`env:prod=true`)
- Categories with hyphens, underscores, numbers (`my-category`, `cat_2`, `v2`)
- Tags with mixed case — verify normalization to lowercase

**References:**
- Normalization: `src/normalize.ts` → `normalizeCategory()`, `normalizeTags()`
- Store add: `src/store.ts` → `add()` method

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/edge-cases.test.ts
```

### Step 2.2: Add token budget boundary tests

Add precise budget boundary tests using custom tokenizer `(text) => text.length`:

- Edict at exact budget (budget=10, text length=10) → should succeed
- Edict at budget+1 (budget=10, text length=11) → should throw `EdictBudgetExceededError`
- Budget after remove: fill to capacity → remove one → add new one that fits in freed space
- Budget after supersession: supersede with larger text that fits in reclaimed budget
- Budget tracking accuracy: add 3 edicts → verify `tokenCount()` equals sum of text lengths
- `tokenBudgetRemaining()` accuracy: verify equals `budget - tokenCount()`

**References:**
- Budget logic: `src/store.ts` → `add()`, `update()`, `tokenCount()`, `tokenBudgetRemaining()`
- Custom tokenizer: `src/store.ts` → `EdictStoreOptions.tokenizer`

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/edge-cases.test.ts
```

### Step 2.3: Add empty/degenerate operation tests

Add tests for operations on empty or edge-case states:

- `search('')` — empty query behavior
- `search('*')` — regex special characters as search terms
- `search('test[')` — unbalanced regex chars
- `find()` with predicate that matches nothing → empty array
- `find()` with FindQuery that matches nothing → empty array
- Multi-filter FindQuery: category + tag + ttl combined
- `render('plain')` on empty store
- `render('markdown')` on empty store
- `render('json')` on empty store
- `stats()` on empty store (all zeros, empty breakdowns)
- `history()` on store with no history → empty array
- `categories()` on empty store → empty array

**References:**
- Search: `src/store.ts` → `search()` method
- Find: `src/store.ts` → `find()` method (both predicate and FindQuery overloads)
- Render: `src/store.ts` → `render()` method
- Stats: `src/store.ts` → `stats()` method

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/edge-cases.test.ts
```

### Step 2.4: Add sequential ID and reload edge cases

Add tests for:

- ID resumption after load: persist e_001 and e_005 → load → add new → should be e_006
- IDs after mixed key/auto edicts: add with key → add without key → verify correct sequential ID
- Multiple `load()` calls (reload behavior) — second load doesn't duplicate edicts
- `save()` twice with no changes between — idempotent, no error
- Adding edict with ALL optional fields specified (tags, confidence, source, key, ttl, expiresAt)
- Adding edict with ONLY required fields (text, category)
- Very long edict text (10KB string) — should work if budget allows

**References:**
- ID generation: `src/store.ts` → `_nextId()` or equivalent
- Load/save: `src/store.ts` → `load()`, `save()`

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/edge-cases.test.ts
```

---

## Phase 3: Edicts Core — End-to-End Lifecycle Tests

**File:** `tests/e2e.test.ts`

### Step 3.1: Create e2e file with full lifecycle scenario

Create `tests/e2e.test.ts`. Implement the primary lifecycle test:

1. Create store, add 3 edicts (2 with shared key prefix, 1 standalone)
2. Render markdown → verify all 3 appear grouped by category
3. Supersede one via key → verify `all()` has 2, `history()` has 1
4. Render again → verify output changed (superseded text appears, old doesn't)
5. Run `review()` → verify compaction candidates include the key-prefix group
6. Compact the group → verify 1 edict + history grew by originals
7. Export data → verify no `_tokens` field in export
8. Import into fresh store → verify identical `all()`, `history()`, `stats()`

**References:**
- All store methods: `src/store.ts`
- Compaction: `src/store.ts` → `review()`, `compact()`
- Export/Import: `src/store.ts` → `exportData()`, `importData()`

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/e2e.test.ts
```

### Step 3.2: Add concurrent session and budget lifecycle scenarios

Add tests for:

- **Concurrent sessions:** store1 adds and saves → store2 loads, adds, saves → store1 reloads → sees all edicts from both sessions
- **Budget management lifecycle:** tight budget → fill near capacity → verify `capacityStatus()` warnings → remove one → add larger → verify budget still tracks
- **Import merge:** store with 2 existing edicts → import data with 2 new edicts → verify store has 4 total

**References:**
- Concurrency: `src/store.ts` → optimistic concurrency via SHA-256 hash
- Capacity: `src/store.ts` → `capacityStatus()`
- Import: `src/store.ts` → `importData()`

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/e2e.test.ts
```

### Step 3.3: Add CLI round-trip scenario

Add test that:

1. Uses CLI (`npx tsx src/cli.ts`) to add an edict
2. Uses CLI to list (verify output contains the edict)
3. Loads the same file programmatically via `EdictStore`
4. Verifies the programmatic view matches CLI output

**References:**
- CLI: `src/cli.ts`
- Existing CLI test pattern: `tests/store-crud-api.test.ts` → last describe block

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run tests/e2e.test.ts
```

---

## Phase 4: Verify Edicts Core Suite

### Step 4.1: Run full edicts test suite

Run all tests to confirm zero regressions and all new tests pass.

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npm test
```

### Step 4.2: Run lint check

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npm run lint
```

---

## Phase 5: Plugin — Expand Tool Tests

**File:** `tests/tools.test.ts` (expand existing)

### Step 5.1: Add `edicts_update` tool tests

Add to existing `describe('registerEdictTools')` block:

- `edicts_update` updates text and returns success message
- `edicts_update` updates multiple fields (text + category + tags)
- `edicts_update` with nonexistent ID returns friendly error message (not stack trace)
- `edicts_update` with validation error (empty text) returns friendly error message

**References:**
- Tool implementation: `src/tools.ts` → `edicts_update` entry in `buildTools()`
- Existing test pattern: `tests/tools.test.ts` → `edicts_add` test

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run tests/tools.test.ts
```

### Step 5.2: Add `edicts_review` tool tests

Add tests:

- `edicts_review` default (preview) returns review output
- `edicts_review` with `action: 'compact'` returns compaction candidates message
- `edicts_review` with `action: 'preview'` explicit returns same as default

**References:**
- Tool implementation: `src/tools.ts` → `edicts_review` entry
- Review in core: `edicts` library → `store.review()`

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run tests/tools.test.ts
```

### Step 5.3: Add `edicts_list` filter and error handling tests

Add tests:

- `edicts_list` with category filter returns only matching edicts
- `edicts_list` with limit parameter truncates results
- `edicts_list` on empty store returns "No edicts found" message
- `edicts_add` with empty text returns friendly validation error
- `edicts_search` with no matches returns "No edicts matched" message
- `edicts_search` with limit parameter
- `edicts_add` with supersession key returns superseded result text

**References:**
- Tool implementations: `src/tools.ts`
- FindQuery support in core: `edicts` → `store.find()`

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run tests/tools.test.ts
```

---

## Phase 6: Plugin — Expand Context and Config Tests

### Step 6.1: Expand context hook tests

**File:** `tests/context.test.ts` (expand existing)

Add tests:

- Hook called twice: first call returns content → add more edicts → second call reflects updated data
- Hook called after removing all edicts → returns `{}` (was returning content, now empty)
- Output `appendSystemContext` starts with expected `## Edicts (Standing Instructions)` header

**References:**
- Hook: `src/context.ts` → `createContextHook()`
- Existing tests: `tests/context.test.ts`

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run tests/context.test.ts
```

### Step 6.2: Expand config edge case tests

**File:** `tests/config.test.ts` (expand existing)

Add tests:

- `path` as number → falls back to default `'edicts.yaml'`
- `path` as null → falls back to default
- `autoInject` as string `"true"` → falls back to default `true`
- `autoInject` as number → falls back to default
- `tokenBudget` as string `"5000"` → falls back to default `2000`
- `tokenBudget` as null → falls back to default
- Extra unknown fields (e.g., `{ unknownField: 'hello' }`) → ignored, no error

**References:**
- Config resolution: `src/config.ts` → `resolveConfig()`
- Existing tests: `tests/config.test.ts`

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run tests/config.test.ts
```

---

## Phase 7: Plugin — Register Integration Tests

**File:** `tests/register.test.ts` (new)

### Step 7.1: Create register integration test file

Create `tests/register.test.ts` that tests the full `plugin.register(api)` entry point from `index.ts`.

Tests:

- `register()` with default config calls both `registerTool()` and `on('before_prompt_build', ...)`
- `register()` with `autoInject: false` calls `registerTool()` but NOT `on()`
- Path is resolved relative to `api.workspaceDir` (verify store uses correct absolute path)
- Default config applied when `pluginConfig` is `undefined`
- Default config applied when `pluginConfig` is `{}`

**References:**
- Plugin entry point: `index.ts` → `plugin.register()`
- Mock API shape: `tests/tools.test.ts` → `registerTool` mock pattern

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run tests/register.test.ts
```

### Step 7.2: Add functional integration tests through register

Add tests that exercise tools and hooks created via `register()`:

- Tools created via `register()` are functional: add edict via tool → list via tool → edict appears
- Hook created via `register()` injects edicts: add via tool → invoke hook → `appendSystemContext` contains edict text

**References:**
- Full wiring: `index.ts` → how `register()` connects tools and hook to the same store instance

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run tests/register.test.ts
```

---

## Phase 8: Verify Plugin Suite

### Step 8.1: Run full plugin test suite

Run all tests to confirm zero regressions and all new tests pass.

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npm test
```

### Step 8.2: Run lint check

**Verification:**
```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npm run lint
```

---

## Phase 9: Final Validation

### Step 9.1: Run both suites back-to-back

Verify both projects pass simultaneously.

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npm test && npm run lint && \
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npm test && npm run lint
```

### Step 9.2: Verify test counts

Confirm test count growth:

- Edicts core: from 155 to ~210+ tests
- Plugin: from 13 to ~38+ tests

**Verification:**
```bash
cd /home/jeanclaude/workspace/edicts && npx vitest run 2>&1 | tail -5
cd /home/jeanclaude/workspace/openclaw-plugin-edicts && npx vitest run 2>&1 | tail -5
```

---

## Summary

| Phase | Project | Action | Files |
|-------|---------|--------|-------|
| 1 | edicts | New: corruption recovery tests | `tests/corruption.test.ts` |
| 2 | edicts | New: edge case tests | `tests/edge-cases.test.ts` |
| 3 | edicts | New: end-to-end lifecycle tests | `tests/e2e.test.ts` |
| 4 | edicts | Verify full suite | — |
| 5 | plugin | Expand: tool tests | `tests/tools.test.ts` |
| 6 | plugin | Expand: context + config tests | `tests/context.test.ts`, `tests/config.test.ts` |
| 7 | plugin | New: register integration tests | `tests/register.test.ts` |
| 8 | plugin | Verify full suite | — |
| 9 | both | Final cross-project validation | — |
