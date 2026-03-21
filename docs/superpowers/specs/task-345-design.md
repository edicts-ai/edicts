# Task #345 — Test Suite & Validation Design

> Designed 2026-03-21

## Goal

Design and implement comprehensive test suites for **two** projects:

1. **`edicts`** (core library) — harden coverage for corruption recovery, edge cases, and end-to-end lifecycle scenarios
2. **`openclaw-plugin-edicts`** (adapter) — fill coverage gaps for untested tools, error handling, and plugin registration wiring

Both suites are separate, independently runnable, and test different concerns.

---

## Baseline

| Project | Tests (before) | Files | Status |
|---------|---------------|-------|--------|
| `edicts` | 155 | 14 | All passing |
| `openclaw-plugin-edicts` | 13 | 3 | All passing |

## Coverage Gap Analysis

### Edicts Core — Gaps Identified

| Gap | Severity | Current Coverage |
|-----|----------|-----------------|
| **Corruption recovery** — malformed YAML, truncated JSON, invalid schema versions, missing fields, non-string values | High | Zero tests |
| **Unicode/multi-byte text** — emoji in text/keys/tags/categories, RTL text, CJK characters | Medium | Zero tests |
| **Budget boundary precision** — exact budget (not just over), budget math after supersession, budget after remove+re-add | Medium | Over-budget tested, exact boundary untested |
| **Empty/degenerate operations** — empty search query, find with no matches, render empty store, stats on empty store | Medium | Partial (some empty cases in store.test.ts) |
| **Special characters in identifiers** — keys with slashes/dots/spaces, categories with hyphens | Medium | Only `/` in keys tested (compaction) |
| **Sequential ID edge cases** — ID resumption after load with gaps, IDs after mixed key/auto edicts | Low | Basic increment tested |
| **CLI error paths** — missing required args, unknown commands, invalid format flag | Medium | Only happy path tested |
| **`importData()` edge cases** — importing expired edicts, duplicate IDs, importing into non-empty store | Medium | Only clean import tested |
| **Multi-filter `find()`** — combining category + tag + ttl + text in FindQuery | Low | Individual filters tested, combos untested |
| **End-to-end lifecycle** — full flow: add → render → supersede → verify → compact → export → import → verify | Medium | Individual operations tested in isolation |

### Plugin — Gaps Identified

| Gap | Severity | Current Coverage |
|-----|----------|-----------------|
| **`edicts_update` tool** | High | Zero tests |
| **`edicts_review` tool** | High | Zero tests |
| **Tool error handling** — validation errors, budget exceeded, not-found for each tool | High | Only remove not-found tested |
| **`edicts_list` with filters** — category, tags, ttl, limit params | Medium | Zero tests (only unfiltered list) |
| **`edicts_search` with limit** — limit param, empty results | Medium | Partial (no limit, no empty) |
| **Plugin `register()` wiring** — full entry point: config → store → tools + hook registration | High | Zero tests (tools.test.ts tests `registerEdictTools` directly, not `plugin.register`) |
| **Context hook re-invocation** — data changes between hook calls, hook idempotency | Medium | Zero tests |
| **Config invalid inputs** — non-string path, non-boolean autoInject, non-number tokenBudget, extra unknown fields | Low | Only valid inputs tested |

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Gap-fill (Option A) — add targeted new files, don't restructure existing | 155 passing tests stay untouched; zero risk of regression |
| Core new files | 3 new test files: `corruption.test.ts`, `edge-cases.test.ts`, `e2e.test.ts` | Clean separation by concern; each file is independently valuable |
| Plugin new files | 1 new file (`register.test.ts`) + expand 3 existing files | `register()` wiring is a new concern; tool/config/context gaps belong in existing files |
| Test isolation | Each test creates its own temp directory; cleanup in `afterEach` | Existing pattern throughout codebase |
| No mocks for core | Real `EdictStore`, real filesystem (temp dirs) | Core tests should test real behavior; mocks hide bugs |
| Mocked plugin API | Mock `registerTool` and `on` for plugin tests | Plugin doesn't own the OpenClaw runtime; existing pattern in tools.test.ts |
| Corruption tests use `writeFile` | Write malformed content directly, then test `store.load()` behavior | Tests what happens when persisted data is damaged |
| Token boundary tests use custom tokenizer | `(text) => text.length` for predictable budget math | Default tokenizer (chars/4) adds rounding uncertainty to boundary tests |

---

## New Test Files — Edicts Core

### `tests/corruption.test.ts`

Tests graceful handling of corrupted/malformed persisted data.

**Scenarios:**
- Completely invalid YAML (random binary / `}{{{not yaml`)
- Truncated YAML (valid prefix, cut mid-edict)
- Valid YAML but wrong shape (array at root, string at root, number at root)
- Missing `version` field → should throw
- Wrong version number (version: 99)
- Missing `edicts` array → should warn and initialize empty
- Edict with missing required fields (`text`, `category`) → should warn/skip
- Edict with wrong types (number for text, array for category)
- Invalid confidence/ttl enum values in persisted data
- Corrupt `history` entries (missing fields, wrong types)
- Empty file (0 bytes)
- Valid JSON file loaded by YAML parser (format mismatch)
- JSON file with trailing garbage
- File with BOM (byte order mark)

### `tests/edge-cases.test.ts`

Tests boundary conditions and unusual-but-valid inputs.

**Scenarios:**
- Unicode text: emoji (🎯), CJK (中文测试), RTL (مرحبا), combining characters
- Unicode in keys, tags, and categories
- Very long edict text (10KB+)
- Edict text at exact token budget (budget=N, edict tokens=N → succeeds; N+1 → fails)
- Budget after remove: add fills budget, remove one, add new one that fits
- Budget after supersession: supersede with larger text that fits in freed budget
- Empty search query behavior
- Search with special regex characters (`.`, `*`, `[`, `(`)
- Find with no matching results returns empty array
- Render on empty store (all 3 formats)
- Stats on empty store
- Sequential ID after load with gap (e.g., e_001, e_005 on disk → next should be e_006)
- Keys with dots, spaces, colons, equals signs
- Categories with hyphens, underscores, numbers
- Tags with mixed case (verify normalization)
- Adding edict with all optional fields specified
- Adding edict with only required fields
- `history()` on store with no history
- Multiple calls to `load()` (reload behavior)
- `save()` called twice with no changes between (idempotent)

### `tests/e2e.test.ts`

End-to-end lifecycle scenarios that span multiple operations.

**Scenarios:**
1. **Full lifecycle:** add 3 edicts → render markdown → supersede one → verify render output changed → compact 2 related → verify 1 edict + 2 history → export → import into fresh store → verify identical state
2. **Concurrent sessions:** store1 adds edicts and saves → store2 loads same file, adds edicts, saves → store1 reloads, sees all edicts
3. **Expiry through lifecycle:** add ephemeral edict with 1s TTL → wait → trigger prune via `all()` → verify moved to history → verify render excludes it
4. **Budget management lifecycle:** create store with tight budget → fill near capacity → verify `capacityStatus()` warnings → remove one → add slightly larger one → verify budget tracking accurate
5. **Import merge:** store with existing edicts → import data with some overlapping IDs → verify merge behavior
6. **CLI round-trip:** CLI add → CLI list → programmatic load → verify consistency

---

## Expanded Tests — Plugin

### `tests/tools.test.ts` (expand)

**New scenarios:**
- `edicts_update`: update text, update category, update tags, update multiple fields
- `edicts_update`: error on nonexistent ID (friendly message, not stack trace)
- `edicts_update`: validation error (empty text) returns friendly message
- `edicts_review`: preview mode returns review result
- `edicts_review`: preview mode with stale edicts
- `edicts_list` with category filter
- `edicts_list` with limit parameter
- `edicts_list` on empty store returns "No edicts found" message
- `edicts_search` with no matches returns "No edicts matched" message
- `edicts_search` with limit parameter
- `edicts_add` with validation error (empty text) returns friendly message
- `edicts_add` with budget exceeded returns friendly message
- `edicts_add` with supersession key returns superseded result

### `tests/context.test.ts` (expand)

**New scenarios:**
- Hook called twice after data mutation between calls (second call reflects new data)
- Hook called after removing all edicts (returns empty after previously returning content)
- Context output contains expected header text

### `tests/config.test.ts` (expand)

**New scenarios:**
- Non-string `path` value (number, null) falls back to default
- Non-boolean `autoInject` (string, number) falls back to default
- Non-number `tokenBudget` (string, null) falls back to default
- Extra unknown fields in config are ignored (not propagated)

### `tests/register.test.ts` (new)

Tests the full `plugin.register(api)` entry point from `index.ts`.

**Scenarios:**
- `register()` calls `registerTool()` and `on('before_prompt_build', ...)` when autoInject=true
- `register()` calls `registerTool()` but NOT `on()` when autoInject=false
- Path resolved relative to `api.workspaceDir`
- Default config applied when `pluginConfig` is `undefined`
- Default config applied when `pluginConfig` is `{}`
- Tools created via `register()` are functional (add → list round-trip)
- Hook created via `register()` injects edicts after tool adds them

---

## Expected Test Counts After Implementation

| Project | Before | Added | After |
|---------|--------|-------|-------|
| `edicts` | 155 | ~55-65 | ~210-220 |
| `openclaw-plugin-edicts` | 13 | ~25-30 | ~38-43 |

## What's NOT In Scope

- **Performance/benchmark tests** — not needed at this library size
- **Coverage percentage targets** — we're testing gaps, not chasing numbers
- **Property-based / fuzz testing** — overkill for a config store library
- **OpenClaw runtime integration tests** — that's OpenClaw's responsibility
- **Restructuring existing tests** — they're fine as-is
