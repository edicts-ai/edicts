# Edicts — CRUD Operations & Programmatic API Design

> Task #342 | Designed 2026-03-20

## Goal

Extend the existing `EdictStore` class (built in #341) with structured query methods, text search, stats, export/import, mutation result metadata, auto-prune on mutation, and a standalone CLI. Zero new runtime dependencies.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `find()` API | Overloaded (predicate OR filter object) | Pre-1.0, no compat burden; one method, two conventions, clean TS overloads |
| Mutation returns | `MutationResult` wrapper | Surfaces token impact + auto-prune side effects explicitly |
| `search()` scope | Multi-field substring, configurable | Searching only text misses tagged/sourced edicts; 200-item scale = instant |
| `stats()` shape | Flat object with configurable `expiringSoonDays` | Derived stats (oldest/avg) are YAGNI, derivable from `all()` |
| CLI arg parsing | `node:util parseArgs` | Built into Node 20+, zero deps, sufficient for this CLI surface |
| Import conflicts | Supersede (same as `add()`) | Consistent with existing key-based supersession; idempotent re-import |
| Export method name | `exportData()` / `importData()` | Avoids collision with JS `export` keyword |

## Section 1: MutationResult & Auto-Prune

### MutationResult

Every mutation (`add`, `update`, `remove`) returns:

```typescript
interface MutationResult {
  edict: Edict | null;          // created/updated edict; null for remove
  tokenImpact: {
    before: number;              // total store tokens before mutation
    after: number;               // total store tokens after mutation
    delta: number;               // after - before (negative = freed)
    budgetRemaining: number;     // tokenBudget - after
  };
  pruned: string[];              // IDs of auto-pruned expired edicts
}
```

### Auto-Prune on Mutation

Before executing any mutation, the store runs `pruneExpired()` on in-memory edicts:
- Expired edicts move to history
- Pruned IDs appear in the `MutationResult.pruned` array
- `add()` at count limit succeeds if expired edicts free a slot
- Token budget checks happen *after* pruning for accurate headroom
- Callers always see what side effects occurred

### Breaking Changes

- `add()` returns `MutationResult` instead of `Edict`
- `update()` returns `MutationResult` instead of `Edict`
- `remove()` returns `MutationResult` instead of `boolean`

Pre-1.0 with zero external users — acceptable. Existing tests updated.

## Section 2: `find()` Overloads & `search()`

### `find()` — Unified Query

```typescript
interface FindFilter {
  category?: string;       // exact match (normalized before comparison)
  tags?: string[];         // AND logic: all must be present (normalized)
}

// Overloads
find(predicate: (e: Edict) => boolean): Edict[];
find(filter: FindFilter): Edict[];
```

- Function argument → filter with it directly
- Object argument → build predicate internally; normalize category/tags from filter
- Empty filter `{}` → returns all edicts
- Both overloads return `structuredClone()` copies

### `search()` — Multi-Field Substring

```typescript
interface SearchOptions {
  fields?: Array<'text' | 'category' | 'tags' | 'source'>;  // default: all four
}

search(query: string, options?: SearchOptions): Edict[];
```

- Case-insensitive substring match
- For `tags`, each tag checked individually against query
- Returns `structuredClone()` copies

## Section 3: `stats()` & Export/Import

### `stats()`

```typescript
interface StatsOptions {
  expiringSoonDays?: number;    // default: 7
}

interface EdictStats {
  total: number;
  tokenCount: number;
  tokenBudget: number;
  tokenUtilization: number;     // 0.0 - 1.0
  byCategory: Record<string, number>;
  byTtl: Record<string, number>;
  byConfidence: Record<string, number>;
  historyCount: number;
  expiringSoon: number;
}

stats(options?: StatsOptions): EdictStats;
```

Synchronous — all data in memory, no I/O.

### `exportData()`

```typescript
type ExportFormat = 'yaml' | 'json';

exportData(format?: ExportFormat): string;
```

Serializes entire store (edicts + history + config) as a string. Defaults to YAML. Same serialization as `save()` but returns string instead of writing to disk.

### `importData()`

```typescript
importData(raw: string, format?: ExportFormat): MutationResult[];
```

Parses input, validates schema, runs each edict through `add()` — existing keys get superseded. Returns array of `MutationResult`, one per imported edict. Format defaults to YAML, auto-detected from content (starts with `{` → JSON, else YAML).

## Section 4: CLI

### Binary

- `bin/edicts.mjs` — 3-line shim calling `src/cli.ts` logic
- Registered in `package.json`: `"bin": { "edicts": "./bin/edicts.mjs" }`

### Implementation

- `src/cli.ts` exports `run(args: string[]): Promise<number>` (returns exit code)
- Uses `node:util parseArgs` — zero deps
- `bin/edicts.mjs` calls `run(process.argv.slice(2))` and sets `process.exitCode`

### Commands

```
edicts list [--category X] [--tag Y] [--format plain|json]
edicts add "text" --category X [--ttl durable] [--key my-key] [--tag a --tag b] [--confidence verified] [--source "origin"]
edicts update <id> [--text "new"] [--category X] [--ttl Y] [--tag a]
edicts remove <id>
edicts search "query" [--field text --field tags]
edicts stats [--format plain|json]
edicts export [--format yaml|json]
edicts import <file> [--format yaml|json]
```

### Common Flags

- `--path <file>` — store file path (default: `./edicts.yaml`), available on all commands

### Output

- Plain text by default for humans
- `--format json` for machine consumption (piping, scripts)
- Exit code 0 on success, 1 on error with message to stderr

### File Structure

- `src/cli.ts` — command parsing, dispatch, output formatting (~200-250 lines)
- `bin/edicts.mjs` — 3-line shim
- `tests/cli.test.ts` — tests via exported `run()` with captured stdout

## Files Changed

### Modified
- `src/types.ts` — add `MutationResult`, `FindFilter`, `SearchOptions`, `StatsOptions`, `EdictStats`, `ExportFormat`
- `src/store.ts` — refactor `add`/`update`/`remove` returns, add `search()`, `stats()`, `exportData()`, `importData()`, overload `find()`, auto-prune on mutation
- `src/index.ts` — export new types and interfaces
- `package.json` — add `"bin"` field
- Existing test files — update for `MutationResult` return types

### Created
- `src/cli.ts` — CLI command handler
- `bin/edicts.mjs` — binary shim
- `tests/cli.test.ts` — CLI tests
- `tests/search.test.ts` — search tests
- `tests/stats.test.ts` — stats tests
- `tests/import-export.test.ts` — import/export tests

## Dependencies

No new runtime dependencies. `node:util parseArgs` is built-in (Node 20+).
