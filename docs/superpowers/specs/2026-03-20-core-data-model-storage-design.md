# Edicts — Core Data Model & Storage Engine Design

> Task #341 | Designed 2026-03-20

## Goal

A standalone, framework-agnostic TypeScript library (`edicts` npm package) that provides a ground-truth data layer for AI agents. YAML/JSON file storage with in-memory mutation, optimistic concurrency, pluggable token counting, and configurable prompt rendering.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API style | Class-based (`EdictStore`) | Natural for stateful store, testable, familiar |
| Token counting | Pluggable with char/4 fallback | Zero-dep default, accurate option via injection |
| Concurrency | Optimistic (content hash) + atomic write | No lockfile deps, human-edit friendly |
| ID generation | Key-derived, sequential fallback | Readable YAML, deterministic for keyed edicts |
| Rendering | Configurable with built-in presets | Every agent framework gets the format it needs |
| Querying | Predicate-based (`find(fn)`) | YAGNI — 200-item store, JS `.filter()` is enough |
| Categories | Normalize + optional allowlist | Zero-config default, strict when needed |

## Data Model

### Edict

```ts
interface Edict {
  id: string;                    // key-derived or sequential (e_001)
  text: string;                  // the actual edict content
  category: string;              // auto-normalized (lowercase, singularized)
  tags: string[];                // free-form, normalized same as category
  confidence: 'verified' | 'inferred' | 'user';
  source: string;                // provenance
  key?: string;                  // dedup/supersession identifier
  ttl: 'ephemeral' | 'event' | 'durable' | 'permanent';
  expiresAt?: string;            // ISO 8601, for ephemeral/event
  created: string;               // ISO 8601
  updated: string;               // ISO 8601
  lastAccessed?: string;         // ISO 8601, updated on render/get
  _tokens?: number;              // cached token count (internal)
}
```

### HistoryEntry

```ts
interface HistoryEntry {
  id: string;                    // originalId__ISO-date
  text: string;
  supersededBy: string;          // ID of replacement (or 'expired')
  archivedAt: string;            // ISO 8601
}
```

### EdictInput (user-facing)

```ts
interface EdictInput {
  text: string;                  // required
  category: string;              // required
  key?: string;
  tags?: string[];
  confidence?: 'verified' | 'inferred' | 'user';  // default: 'user'
  source?: string;
  ttl?: 'ephemeral' | 'event' | 'durable' | 'permanent';  // default: 'durable'
  expiresAt?: string;
}
```

### ID Generation

- Key provided → `id = key` (e.g., `product-v2-status`)
- No key → sequential `e_001`, `e_002` (scan existing for next)
- History: `{originalId}__{YYYYMMDD}` (e.g., `product-v2-status__20260320`)

## Store Configuration

```ts
interface EdictStoreOptions {
  path?: string;                  // default: './edicts.yaml'
  format?: 'yaml' | 'json';      // default: 'yaml' (inferred from extension)
  maxEdicts?: number;             // default: 200
  tokenBudget?: number;           // default: 4000
  tokenizer?: (text: string) => number;  // default: chars/4
  categories?: string[];          // optional allowlist
  renderer?: (edicts: Edict[]) => string; // custom render function
}
```

## Public API

```ts
class EdictStore {
  // Lifecycle
  constructor(options?: EdictStoreOptions);
  async load(): Promise<void>;
  async save(): Promise<void>;

  // Mutations
  add(input: EdictInput): Edict;
  remove(id: string): boolean;
  update(id: string, patch: Partial<EdictInput>): Edict;

  // Reads
  get(id: string): Edict | undefined;
  has(id: string): boolean;
  all(): Edict[];
  find(predicate: (e: Edict) => boolean): Edict[];
  categories(): string[];
  history(): HistoryEntry[];

  // Rendering
  render(format?: 'plain' | 'markdown' | 'json'): string;

  // Budget
  tokenCount(): number;
  tokenBudgetRemaining(): number;
  isOverBudget(): boolean;

  // Meta
  readonly dirty: boolean;
  readonly fileHash: string;
}
```

## Key Behaviors

### Supersession
`add()` with an existing `key` replaces the old edict. The old version moves to history with a timestamped ID. The new edict keeps the same ID (= the key).

### Budget Enforcement
`add()` when over budget throws `EdictBudgetExceededError`. Caller decides eviction strategy.

### Optimistic Concurrency
`save()` re-reads the file and compares content hash to the hash captured at `load()`. Mismatch throws `EdictConflictError` with `{ onDisk, inMemory }`.

### Atomic Writes
All saves write to a temp file first, then `rename()`. Prevents corruption from partial writes.

### Validation on Load
- Schema check (required fields, correct types)
- Prune expired edicts (move to history with `supersededBy: 'expired'`)
- Normalize categories/tags
- Warn on recoverable issues (missing optional fields get defaults)

### Category Normalization
Always applied: lowercase, trim, strip trailing 's' for simple plurals. Optional allowlist rejects unknown categories with `EdictCategoryError`.

`store.categories()` returns distinct categories currently in use for discoverability.

## File Format

### YAML (primary)

```yaml
version: 1
config:
  maxEdicts: 200
  tokenBudget: 4000
  categories: []
edicts:
  - id: product-v2-status
    text: "Product v2.0 launches April 15, 2026"
    category: product
    tags: [launch, v2]
    confidence: verified
    source: "CEO directive, 2026-03-20"
    key: product-v2-status
    ttl: event
    expiresAt: "2026-04-16T00:00:00Z"
    created: "2026-03-20T06:00:00Z"
    updated: "2026-03-20T06:00:00Z"
history:
  - id: product-v2-status__20260320
    text: "Product v2.0 estimated for Q2 2026"
    supersededBy: product-v2-status
    archivedAt: "2026-03-20T06:00:00Z"
```

JSON format is identical structure, auto-detected from file extension.

## Package Structure

```
edicts/
├── src/
│   ├── index.ts              # public exports
│   ├── store.ts              # EdictStore class
│   ├── types.ts              # interfaces & type definitions
│   ├── schema.ts             # validation logic
│   ├── normalize.ts          # category/tag normalization
│   ├── tokenizer.ts          # default char/4 tokenizer
│   ├── renderer.ts           # built-in renderers (plain, markdown, json)
│   ├── storage/
│   │   ├── yaml.ts           # YAML read/write + atomic save
│   │   ├── json.ts           # JSON read/write + atomic save
│   │   └── base.ts           # storage interface
│   └── errors.ts             # custom error classes
├── tests/
│   ├── store.test.ts
│   ├── supersession.test.ts
│   ├── concurrency.test.ts
│   ├── normalize.test.ts
│   ├── tokenizer.test.ts
│   ├── renderer.test.ts
│   ├── schema.test.ts
│   └── storage.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── LICENSE
```

## Dependencies

- **Runtime:** `yaml` (~50KB, zero transitive deps)
- **Dev:** `vitest`, `typescript`, `tsup`

## Error Classes

- `EdictBudgetExceededError` — add would exceed token budget
- `EdictConflictError` — file changed since load (optimistic concurrency)
- `EdictCategoryError` — category not in allowlist
- `EdictValidationError` — schema validation failure
- `EdictNotFoundError` — get/update/remove on nonexistent ID
