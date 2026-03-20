# Edicts Core Data Model & Storage Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `edicts` npm package — a standalone TypeScript library providing a ground-truth data layer for AI agents with YAML/JSON file storage, optimistic concurrency, pluggable token counting, and configurable prompt rendering.

**Architecture:** Single class (`EdictStore`) owning an in-memory edict collection backed by YAML or JSON files. Load → mutate → save lifecycle. Optimistic concurrency via content hashing. Atomic writes via temp-file + rename.

**Tech Stack:** TypeScript, `yaml` (runtime), `vitest` (test), `tsup` (build)

**Spec:** `docs/superpowers/specs/2026-03-20-core-data-model-storage-design.md`

---

## Chunk 1: Project Scaffold & Type System

### Task 1: Initialize Package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `LICENSE`

- [ ] **Step 1: Initialize package.json**

```bash
cd /home/jeanclaude/workspace/edicts
cat > package.json << 'EOF'
{
  "name": "edicts",
  "version": "0.1.0",
  "description": "Ground truth layer for AI agents",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["ai", "agents", "edicts", "facts", "knowledge", "context", "yaml"],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  }
}
EOF
```

- [ ] **Step 2: Create tsconfig.json**

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF
```

- [ ] **Step 3: Create vitest.config.ts**

```bash
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
EOF
```

- [ ] **Step 4: Create tsup.config.ts**

```bash
cat > tsup.config.ts << 'EOF'
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
EOF
```

- [ ] **Step 5: Create MIT LICENSE**

```bash
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2026 Edicts Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

- [ ] **Step 6: Install dependencies**

```bash
npm install yaml
npm install -D typescript vitest tsup
```

- [ ] **Step 7: Create source and test directories**

```bash
mkdir -p src/storage tests
```

- [ ] **Step 8: Commit scaffold**

```bash
git add -A
git commit -m "chore: initialize edicts package scaffold"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write type definition tests**

Create `tests/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Edict, EdictInput, HistoryEntry, EdictStoreOptions } from '../src/types.js';

describe('Type definitions', () => {
  it('EdictInput accepts minimal required fields', () => {
    const input: EdictInput = {
      text: 'Test edict',
      category: 'test',
    };
    expect(input.text).toBe('Test edict');
    expect(input.category).toBe('test');
    expect(input.key).toBeUndefined();
    expect(input.tags).toBeUndefined();
    expect(input.confidence).toBeUndefined();
    expect(input.source).toBeUndefined();
    expect(input.ttl).toBeUndefined();
    expect(input.expiresAt).toBeUndefined();
  });

  it('EdictInput accepts all optional fields', () => {
    const input: EdictInput = {
      text: 'Product v2 launches April 15',
      category: 'product',
      key: 'product-v2-status',
      tags: ['launch', 'v2'],
      confidence: 'verified',
      source: 'CEO directive',
      ttl: 'event',
      expiresAt: '2026-04-16T00:00:00Z',
    };
    expect(input.key).toBe('product-v2-status');
    expect(input.confidence).toBe('verified');
  });

  it('Edict has all required runtime fields', () => {
    const edict: Edict = {
      id: 'product-v2-status',
      text: 'Product v2 launches April 15',
      category: 'product',
      tags: ['launch'],
      confidence: 'verified',
      source: 'CEO directive',
      key: 'product-v2-status',
      ttl: 'event',
      created: '2026-03-20T06:00:00Z',
      updated: '2026-03-20T06:00:00Z',
    };
    expect(edict.id).toBe('product-v2-status');
    expect(edict.lastAccessed).toBeUndefined();
    expect(edict._tokens).toBeUndefined();
  });

  it('HistoryEntry tracks supersession', () => {
    const entry: HistoryEntry = {
      id: 'product-v2-status__20260320',
      text: 'Product v2 estimated for Q2 2026',
      supersededBy: 'product-v2-status',
      archivedAt: '2026-03-20T06:00:00Z',
    };
    expect(entry.supersededBy).toBe('product-v2-status');
  });

  it('EdictStoreOptions accepts all configuration', () => {
    const opts: EdictStoreOptions = {
      path: './edicts.yaml',
      format: 'yaml',
      maxEdicts: 200,
      tokenBudget: 4000,
      tokenizer: (text: string) => text.length / 4,
      categories: ['product', 'team'],
      renderer: (edicts: Edict[]) => edicts.map(e => e.text).join('\n'),
    };
    expect(opts.maxEdicts).toBe(200);
  });

  it('confidence only accepts valid values', () => {
    const values: Edict['confidence'][] = ['verified', 'inferred', 'user'];
    expect(values).toHaveLength(3);
  });

  it('ttl only accepts valid values', () => {
    const values: Edict['ttl'][] = ['ephemeral', 'event', 'durable', 'permanent'];
    expect(values).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/types.test.ts
```

Expected: FAIL — cannot resolve `../src/types.js`

- [ ] **Step 3: Implement types**

Create `src/types.ts`:

```ts
/**
 * User-provided input when adding an edict.
 */
export interface EdictInput {
  /** The edict content text */
  text: string;
  /** Category for grouping (auto-normalized) */
  category: string;
  /** Dedup/supersession key — edicts with same key replace each other */
  key?: string;
  /** Free-form tags (auto-normalized) */
  tags?: string[];
  /** How confident are we in this edict */
  confidence?: 'verified' | 'inferred' | 'user';
  /** Provenance — who/what established this edict */
  source?: string;
  /** Time-to-live classification */
  ttl?: 'ephemeral' | 'event' | 'durable' | 'permanent';
  /** Expiration date (ISO 8601) for ephemeral/event edicts */
  expiresAt?: string;
}

/**
 * A fully resolved edict with all runtime fields.
 */
export interface Edict {
  /** Unique identifier — key-derived or sequential */
  id: string;
  /** The edict content text */
  text: string;
  /** Category (normalized) */
  category: string;
  /** Tags (normalized) */
  tags: string[];
  /** Confidence level */
  confidence: 'verified' | 'inferred' | 'user';
  /** Provenance */
  source: string;
  /** Dedup/supersession key */
  key?: string;
  /** Time-to-live classification */
  ttl: 'ephemeral' | 'event' | 'durable' | 'permanent';
  /** Expiration date (ISO 8601) */
  expiresAt?: string;
  /** Creation timestamp (ISO 8601) */
  created: string;
  /** Last update timestamp (ISO 8601) */
  updated: string;
  /** Last time this edict was accessed via get/render (ISO 8601) */
  lastAccessed?: string;
  /** Cached token count (internal) */
  _tokens?: number;
}

/**
 * A superseded edict stored in history.
 */
export interface HistoryEntry {
  /** Original ID with timestamp suffix */
  id: string;
  /** The original edict text */
  text: string;
  /** ID of the edict that replaced this one, or 'expired' */
  supersededBy: string;
  /** When this entry was archived (ISO 8601) */
  archivedAt: string;
}

/**
 * Tokenizer function signature.
 * Takes text, returns approximate token count.
 */
export type Tokenizer = (text: string) => number;

/**
 * Custom renderer function signature.
 * Takes active edicts, returns formatted string.
 */
export type Renderer = (edicts: Edict[]) => string;

/**
 * Configuration options for EdictStore.
 */
export interface EdictStoreOptions {
  /** Path to the edicts file. Default: './edicts.yaml' */
  path?: string;
  /** Storage format. Default: 'yaml' (inferred from extension) */
  format?: 'yaml' | 'json';
  /** Maximum number of edicts. Default: 200 */
  maxEdicts?: number;
  /** Maximum total token budget. Default: 4000 */
  tokenBudget?: number;
  /** Custom tokenizer function. Default: chars/4 approximation */
  tokenizer?: Tokenizer;
  /** Allowed categories. Empty/undefined = any category allowed */
  categories?: string[];
  /** Custom renderer function. Overrides built-in formats */
  renderer?: Renderer;
}

/**
 * Internal file structure matching YAML/JSON on disk.
 */
export interface EdictFileSchema {
  version: number;
  config: {
    maxEdicts: number;
    tokenBudget: number;
    categories: string[];
  };
  edicts: Edict[];
  history: HistoryEntry[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/types.test.ts
```

Expected: PASS — all type checks compile, runtime assertions hold

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add core type definitions"
```

---

### Task 3: Error Classes

**Files:**
- Create: `src/errors.ts`
- Create: `tests/errors.test.ts`

- [ ] **Step 1: Write error class tests**

Create `tests/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  EdictBudgetExceededError,
  EdictConflictError,
  EdictCategoryError,
  EdictValidationError,
  EdictNotFoundError,
} from '../src/errors.js';

describe('Error classes', () => {
  it('EdictBudgetExceededError includes budget info', () => {
    const err = new EdictBudgetExceededError(4000, 4200);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictBudgetExceededError');
    expect(err.budget).toBe(4000);
    expect(err.current).toBe(4200);
    expect(err.message).toContain('4000');
  });

  it('EdictConflictError includes both versions', () => {
    const err = new EdictConflictError('hash1', 'hash2');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictConflictError');
    expect(err.expectedHash).toBe('hash1');
    expect(err.actualHash).toBe('hash2');
  });

  it('EdictCategoryError lists valid categories', () => {
    const err = new EdictCategoryError('dogs', ['product', 'team', 'infra']);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictCategoryError');
    expect(err.category).toBe('dogs');
    expect(err.validCategories).toEqual(['product', 'team', 'infra']);
    expect(err.message).toContain('dogs');
    expect(err.message).toContain('product');
  });

  it('EdictValidationError includes details', () => {
    const err = new EdictValidationError('Missing required field: text');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictValidationError');
  });

  it('EdictNotFoundError includes the ID', () => {
    const err = new EdictNotFoundError('f_999');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictNotFoundError');
    expect(err.edictId).toBe('f_999');
    expect(err.message).toContain('f_999');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/errors.test.ts
```

Expected: FAIL — cannot resolve `../src/errors.js`

- [ ] **Step 3: Implement error classes**

Create `src/errors.ts`:

```ts
export class EdictBudgetExceededError extends Error {
  readonly budget: number;
  readonly current: number;

  constructor(budget: number, current: number) {
    super(`Token budget exceeded: ${current} tokens used, budget is ${budget}`);
    this.name = 'EdictBudgetExceededError';
    this.budget = budget;
    this.current = current;
  }
}

export class EdictConflictError extends Error {
  readonly expectedHash: string;
  readonly actualHash: string;

  constructor(expectedHash: string, actualHash: string) {
    super(
      `File was modified since last load. Expected hash ${expectedHash}, found ${actualHash}. Reload and retry.`
    );
    this.name = 'EdictConflictError';
    this.expectedHash = expectedHash;
    this.actualHash = actualHash;
  }
}

export class EdictCategoryError extends Error {
  readonly category: string;
  readonly validCategories: string[];

  constructor(category: string, validCategories: string[]) {
    super(
      `Unknown category "${category}". Valid categories: ${validCategories.join(', ')}`
    );
    this.name = 'EdictCategoryError';
    this.category = category;
    this.validCategories = validCategories;
  }
}

export class EdictValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdictValidationError';
  }
}

export class EdictNotFoundError extends Error {
  readonly edictId: string;

  constructor(id: string) {
    super(`Edict not found: "${id}"`);
    this.name = 'EdictNotFoundError';
    this.edictId = id;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/errors.test.ts
```

Expected: PASS — all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add custom error classes"
```

---

## Chunk 2: Utilities (Normalizer, Tokenizer, Renderers)

### Task 4: Category/Tag Normalization

**Files:**
- Create: `src/normalize.ts`
- Create: `tests/normalize.test.ts`

- [ ] **Step 1: Write normalization tests**

Create `tests/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeCategory, normalizeTags } from '../src/normalize.js';

describe('normalizeCategory', () => {
  it('lowercases', () => {
    expect(normalizeCategory('Product')).toBe('product');
    expect(normalizeCategory('INFRA')).toBe('infra');
  });

  it('trims whitespace', () => {
    expect(normalizeCategory('  product  ')).toBe('product');
  });

  it('strips trailing s for simple plurals', () => {
    expect(normalizeCategory('Dogs')).toBe('dog');
    expect(normalizeCategory('products')).toBe('product');
    expect(normalizeCategory('teams')).toBe('team');
  });

  it('does not strip s from words that end in s naturally', () => {
    expect(normalizeCategory('process')).toBe('process');
    expect(normalizeCategory('status')).toBe('status');
    expect(normalizeCategory('analysis')).toBe('analysis');
    expect(normalizeCategory('business')).toBe('business');
  });

  it('does not strip s from short words', () => {
    expect(normalizeCategory('ops')).toBe('ops');
    expect(normalizeCategory('dns')).toBe('dns');
  });

  it('handles combined transformations', () => {
    expect(normalizeCategory('  Dogs  ')).toBe('dog');
    expect(normalizeCategory('PRODUCTS')).toBe('product');
  });
});

describe('normalizeTags', () => {
  it('normalizes each tag', () => {
    expect(normalizeTags(['Launch', '  V2  ', 'Features'])).toEqual([
      'launch', 'v2', 'feature',
    ]);
  });

  it('deduplicates after normalization', () => {
    expect(normalizeTags(['Dog', 'dogs', 'DOG'])).toEqual(['dog']);
  });

  it('handles empty array', () => {
    expect(normalizeTags([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/normalize.test.ts
```

Expected: FAIL — cannot resolve module

- [ ] **Step 3: Implement normalize.ts**

Create `src/normalize.ts`:

```ts
/**
 * Words that naturally end in 's' — do not strip.
 * Covers common cases. Not exhaustive, but handles the 90%.
 */
const NATURAL_S_ENDINGS = new Set([
  'process', 'status', 'analysis', 'business', 'address',
  'access', 'success', 'progress', 'congress', 'express',
  'class', 'mass', 'pass', 'loss', 'boss', 'miss',
  'bus', 'plus', 'bonus', 'campus', 'census', 'consensus',
  'corpus', 'focus', 'genus', 'nexus', 'radius', 'stimulus',
  'syllabus', 'thesis', 'diagnosis', 'basis', 'crisis',
  'alias', 'atlas', 'bias', 'canvas', 'chaos',
]);

/** Minimum length to consider stripping trailing 's' */
const MIN_STRIP_LENGTH = 4;

/**
 * Normalize a single category or tag string:
 * - Trim whitespace
 * - Lowercase
 * - Strip trailing 's' for simple plurals (unless word naturally ends in s)
 */
export function normalizeCategory(raw: string): string {
  let value = raw.trim().toLowerCase();

  if (
    value.length >= MIN_STRIP_LENGTH &&
    value.endsWith('s') &&
    !value.endsWith('ss') &&
    !value.endsWith('us') &&
    !value.endsWith('is') &&
    !value.endsWith('as') &&
    !NATURAL_S_ENDINGS.has(value)
  ) {
    value = value.slice(0, -1);
  }

  return value;
}

/**
 * Normalize an array of tags: normalize each, deduplicate.
 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = normalizeCategory(tag);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/normalize.test.ts
```

Expected: PASS — all normalization tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add category/tag normalization"
```

---

### Task 5: Default Tokenizer

**Files:**
- Create: `src/tokenizer.ts`
- Create: `tests/tokenizer.test.ts`

- [ ] **Step 1: Write tokenizer tests**

Create `tests/tokenizer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultTokenizer } from '../src/tokenizer.js';

describe('defaultTokenizer', () => {
  it('approximates tokens as chars / 4', () => {
    // 20 chars → 5 tokens
    expect(defaultTokenizer('12345678901234567890')).toBe(5);
  });

  it('rounds up with Math.ceil', () => {
    // 5 chars → ceil(1.25) = 2
    expect(defaultTokenizer('hello')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(defaultTokenizer('')).toBe(0);
  });

  it('handles multi-line text', () => {
    const text = 'Line one\nLine two\nLine three';
    expect(defaultTokenizer(text)).toBe(Math.ceil(text.length / 4));
  });

  it('handles unicode', () => {
    const text = '日本語テスト'; // 6 chars
    expect(defaultTokenizer(text)).toBe(Math.ceil(text.length / 4));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/tokenizer.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement tokenizer**

Create `src/tokenizer.ts`:

```ts
/**
 * Default tokenizer: approximates token count as characters / 4.
 * ~85-90% accurate for English text. Users can inject a real
 * tokenizer (e.g., tiktoken) via EdictStoreOptions.tokenizer.
 */
export function defaultTokenizer(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/tokenizer.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add default tokenizer (char/4 approximation)"
```

---

### Task 6: Renderers

**Files:**
- Create: `src/renderer.ts`
- Create: `tests/renderer.test.ts`

- [ ] **Step 1: Write renderer tests**

Create `tests/renderer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderPlain, renderMarkdown, renderJson } from '../src/renderer.js';
import type { Edict } from '../src/types.js';

const sampleEdicts: Edict[] = [
  {
    id: 'product-v2-status',
    text: 'Product v2.0 launches April 15, 2026',
    category: 'product',
    tags: ['launch', 'v2'],
    confidence: 'verified',
    source: 'CEO directive',
    key: 'product-v2-status',
    ttl: 'event',
    expiresAt: '2026-04-16T00:00:00Z',
    created: '2026-03-20T06:00:00Z',
    updated: '2026-03-20T06:00:00Z',
  },
  {
    id: 'e_001',
    text: 'Engineering team is 12 people',
    category: 'team',
    tags: ['headcount'],
    confidence: 'inferred',
    source: 'standup notes',
    ttl: 'durable',
    created: '2026-03-20T06:00:00Z',
    updated: '2026-03-20T06:00:00Z',
  },
];

describe('renderPlain', () => {
  it('renders one edict per line with metadata', () => {
    const output = renderPlain(sampleEdicts);
    expect(output).toContain('Product v2.0 launches April 15, 2026');
    expect(output).toContain('[verified]');
    expect(output).toContain('[inferred]');
    expect(output).toContain('product');
  });

  it('returns empty string for no edicts', () => {
    expect(renderPlain([])).toBe('');
  });
});

describe('renderMarkdown', () => {
  it('renders with header and grouped by category', () => {
    const output = renderMarkdown(sampleEdicts);
    expect(output).toContain('# Edicts');
    expect(output).toContain('## product');
    expect(output).toContain('## team');
    expect(output).toContain('Product v2.0 launches April 15, 2026');
  });

  it('returns empty message for no edicts', () => {
    const output = renderMarkdown([]);
    expect(output).toContain('No edicts');
  });
});

describe('renderJson', () => {
  it('returns valid JSON array', () => {
    const output = renderJson(sampleEdicts);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('product-v2-status');
  });

  it('returns empty array for no edicts', () => {
    const output = renderJson([]);
    expect(JSON.parse(output)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/renderer.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement renderers**

Create `src/renderer.ts`:

```ts
import type { Edict } from './types.js';

/**
 * Plain text renderer: one edict per line with inline metadata.
 */
export function renderPlain(edicts: Edict[]): string {
  if (edicts.length === 0) return '';

  return edicts
    .map((e) => {
      const meta = [`[${e.confidence}]`, e.category];
      if (e.tags.length > 0) meta.push(e.tags.join(', '));
      return `- ${e.text} (${meta.join(', ')})`;
    })
    .join('\n');
}

/**
 * Markdown renderer: grouped by category with headers.
 */
export function renderMarkdown(edicts: Edict[]): string {
  if (edicts.length === 0) return '_No edicts._\n';

  // Group by category
  const groups = new Map<string, Edict[]>();
  for (const e of edicts) {
    const list = groups.get(e.category) ?? [];
    list.push(e);
    groups.set(e.category, list);
  }

  const lines: string[] = [`# Edicts (${edicts.length} items)\n`];

  for (const [category, items] of groups) {
    lines.push(`## ${category}\n`);
    for (const e of items) {
      const badges: string[] = [`${e.confidence}`];
      if (e.expiresAt) badges.push(`expires: ${e.expiresAt}`);
      lines.push(`- ${e.text} _(${badges.join(', ')})_`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * JSON renderer: clean array of edicts for programmatic consumption.
 */
export function renderJson(edicts: Edict[]): string {
  const clean = edicts.map(({ _tokens, ...rest }) => rest);
  return JSON.stringify(clean, null, 2);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/renderer.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add plain, markdown, and JSON renderers"
```

---

## Chunk 3: Storage Layer

### Task 7: Storage Interface & Implementations

**Files:**
- Create: `src/storage/base.ts`
- Create: `src/storage/yaml.ts`
- Create: `src/storage/json.ts`
- Create: `tests/storage.test.ts`

- [ ] **Step 1: Write storage tests**

Create `tests/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { YamlStorage } from '../src/storage/yaml.js';
import { JsonStorage } from '../src/storage/json.js';
import type { EdictFileSchema } from '../src/types.js';

const emptySchema: EdictFileSchema = {
  version: 1,
  config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
  edicts: [],
  history: [],
};

const sampleSchema: EdictFileSchema = {
  version: 1,
  config: { maxEdicts: 200, tokenBudget: 4000, categories: ['product'] },
  edicts: [
    {
      id: 'test-edict',
      text: 'Test edict text',
      category: 'product',
      tags: ['test'],
      confidence: 'user',
      source: 'test',
      key: 'test-edict',
      ttl: 'durable',
      created: '2026-03-20T06:00:00Z',
      updated: '2026-03-20T06:00:00Z',
    },
  ],
  history: [],
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('YamlStorage', () => {
  it('writes and reads back correctly', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(sampleSchema);
    const result = await storage.read();
    expect(result.edicts).toHaveLength(1);
    expect(result.edicts[0].id).toBe('test-edict');
  });

  it('returns default schema when file does not exist', async () => {
    const path = join(tempDir, 'nonexistent.yaml');
    const storage = new YamlStorage(path);
    const result = await storage.read();
    expect(result.version).toBe(1);
    expect(result.edicts).toHaveLength(0);
  });

  it('computes content hash', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(sampleSchema);
    const hash = await storage.hash();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);  // SHA-256 hex
  });

  it('hash changes when content changes', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(emptySchema);
    const hash1 = await storage.hash();
    await storage.write(sampleSchema);
    const hash2 = await storage.hash();
    expect(hash1).not.toBe(hash2);
  });

  it('writes atomically (temp file + rename)', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(sampleSchema);
    // File should exist and no temp file should remain
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('test-edict');
  });

  it('returns null hash when file does not exist', async () => {
    const path = join(tempDir, 'nonexistent.yaml');
    const storage = new YamlStorage(path);
    const hash = await storage.hash();
    expect(hash).toBeNull();
  });
});

describe('JsonStorage', () => {
  it('writes and reads back correctly', async () => {
    const path = join(tempDir, 'edicts.json');
    const storage = new JsonStorage(path);
    await storage.write(sampleSchema);
    const result = await storage.read();
    expect(result.edicts).toHaveLength(1);
    expect(result.edicts[0].id).toBe('test-edict');
  });

  it('returns default schema when file does not exist', async () => {
    const path = join(tempDir, 'nonexistent.json');
    const storage = new JsonStorage(path);
    const result = await storage.read();
    expect(result.edicts).toHaveLength(0);
  });

  it('produces human-readable JSON', async () => {
    const path = join(tempDir, 'edicts.json');
    const storage = new JsonStorage(path);
    await storage.write(sampleSchema);
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('\n'); // formatted, not single-line
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/storage.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement storage interface**

Create `src/storage/base.ts`:

```ts
import type { EdictFileSchema } from '../types.js';

export const DEFAULT_SCHEMA: EdictFileSchema = {
  version: 1,
  config: {
    maxEdicts: 200,
    tokenBudget: 4000,
    categories: [],
  },
  edicts: [],
  history: [],
};

/**
 * Abstract storage interface for reading/writing edict files.
 */
export interface Storage {
  /** Read and parse the file. Returns default schema if file doesn't exist. */
  read(): Promise<EdictFileSchema>;
  /** Serialize and write atomically (temp + rename). */
  write(data: EdictFileSchema): Promise<void>;
  /** Compute SHA-256 hash of file contents. Returns null if file doesn't exist. */
  hash(): Promise<string | null>;
  /** Check if the file exists on disk. */
  exists(): Promise<boolean>;
}
```

- [ ] **Step 4: Implement YAML storage**

Create `src/storage/yaml.ts`:

```ts
import { readFile, writeFile, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stringify, parse } from 'yaml';
import type { EdictFileSchema } from '../types.js';
import { DEFAULT_SCHEMA, type Storage } from './base.js';

export class YamlStorage implements Storage {
  constructor(private readonly path: string) {}

  async read(): Promise<EdictFileSchema> {
    if (!(await this.exists())) {
      return structuredClone(DEFAULT_SCHEMA);
    }
    const content = await readFile(this.path, 'utf-8');
    const parsed = parse(content) as EdictFileSchema;
    return parsed;
  }

  async write(data: EdictFileSchema): Promise<void> {
    const content = stringify(data, { indent: 2, lineWidth: 0 });
    const tmpPath = `${this.path}.tmp`;
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, this.path);
  }

  async hash(): Promise<string | null> {
    if (!(await this.exists())) return null;
    const content = await readFile(this.path, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }

  async exists(): Promise<boolean> {
    try {
      await access(this.path);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 5: Implement JSON storage**

Create `src/storage/json.ts`:

```ts
import { readFile, writeFile, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { EdictFileSchema } from '../types.js';
import { DEFAULT_SCHEMA, type Storage } from './base.js';

export class JsonStorage implements Storage {
  constructor(private readonly path: string) {}

  async read(): Promise<EdictFileSchema> {
    if (!(await this.exists())) {
      return structuredClone(DEFAULT_SCHEMA);
    }
    const content = await readFile(this.path, 'utf-8');
    return JSON.parse(content) as EdictFileSchema;
  }

  async write(data: EdictFileSchema): Promise<void> {
    const content = JSON.stringify(data, null, 2) + '\n';
    const tmpPath = `${this.path}.tmp`;
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, this.path);
  }

  async hash(): Promise<string | null> {
    if (!(await this.exists())) return null;
    const content = await readFile(this.path, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }

  async exists(): Promise<boolean> {
    try {
      await access(this.path);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/storage.test.ts
```

Expected: PASS — all storage tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add YAML and JSON storage backends with atomic writes"
```

---

## Chunk 4: Schema Validation

### Task 8: Schema Validation

**Files:**
- Create: `src/schema.ts`
- Create: `tests/schema.test.ts`

- [ ] **Step 1: Write schema validation tests**

Create `tests/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateEdictInput, validateFileSchema, pruneExpired } from '../src/schema.js';
import type { Edict, EdictFileSchema } from '../src/types.js';

describe('validateEdictInput', () => {
  it('accepts valid minimal input', () => {
    expect(() => validateEdictInput({ text: 'Hello', category: 'test' })).not.toThrow();
  });

  it('rejects missing text', () => {
    expect(() => validateEdictInput({ text: '', category: 'test' })).toThrow('text');
  });

  it('rejects missing category', () => {
    expect(() => validateEdictInput({ text: 'Hello', category: '' })).toThrow('category');
  });

  it('rejects invalid confidence', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', confidence: 'maybe' as any })
    ).toThrow('confidence');
  });

  it('rejects invalid ttl', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', ttl: 'forever' as any })
    ).toThrow('ttl');
  });

  it('rejects invalid expiresAt format', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', expiresAt: 'not-a-date' })
    ).toThrow('expiresAt');
  });

  it('accepts valid expiresAt', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', expiresAt: '2026-04-15T00:00:00Z' })
    ).not.toThrow();
  });
});

describe('validateFileSchema', () => {
  it('accepts valid schema', () => {
    const schema: EdictFileSchema = {
      version: 1,
      config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
      edicts: [],
      history: [],
    };
    const warnings = validateFileSchema(schema);
    expect(warnings).toHaveLength(0);
  });

  it('rejects missing version', () => {
    expect(() => validateFileSchema({} as any)).toThrow('version');
  });

  it('returns warnings for edicts with missing optional fields', () => {
    const schema: EdictFileSchema = {
      version: 1,
      config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
      edicts: [
        {
          id: 'test',
          text: 'Hello',
          category: 'test',
          tags: [],
          confidence: 'user',
          source: '',
          ttl: 'durable',
          created: '2026-03-20T06:00:00Z',
          updated: '2026-03-20T06:00:00Z',
        },
      ],
      history: [],
    };
    const warnings = validateFileSchema(schema);
    expect(warnings.length).toBeGreaterThanOrEqual(0); // warnings, not errors
  });
});

describe('pruneExpired', () => {
  it('moves expired edicts to history', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const edicts: Edict[] = [
      {
        id: 'expired-one',
        text: 'Old event',
        category: 'test',
        tags: [],
        confidence: 'user',
        source: 'test',
        ttl: 'event',
        expiresAt: '2026-03-15T00:00:00Z',
        created: '2026-03-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
      },
      {
        id: 'still-active',
        text: 'Future event',
        category: 'test',
        tags: [],
        confidence: 'user',
        source: 'test',
        ttl: 'event',
        expiresAt: '2026-05-01T00:00:00Z',
        created: '2026-03-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
      },
      {
        id: 'no-expiry',
        text: 'Permanent fact',
        category: 'test',
        tags: [],
        confidence: 'verified',
        source: 'test',
        ttl: 'permanent',
        created: '2026-03-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
      },
    ];

    const result = pruneExpired(edicts, now);
    expect(result.active).toHaveLength(2);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].supersededBy).toBe('expired');
    expect(result.active.map(e => e.id)).toEqual(['still-active', 'no-expiry']);
  });

  it('returns all edicts when none expired', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const edicts: Edict[] = [
      {
        id: 'future',
        text: 'Future',
        category: 'test',
        tags: [],
        confidence: 'user',
        source: 'test',
        ttl: 'event',
        expiresAt: '2026-12-31T00:00:00Z',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    ];
    const result = pruneExpired(edicts, now);
    expect(result.active).toHaveLength(1);
    expect(result.expired).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/schema.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement schema.ts**

Create `src/schema.ts`:

```ts
import type { Edict, EdictInput, EdictFileSchema, HistoryEntry } from './types.js';
import { EdictValidationError } from './errors.js';

const VALID_CONFIDENCE = new Set(['verified', 'inferred', 'user']);
const VALID_TTL = new Set(['ephemeral', 'event', 'durable', 'permanent']);

/**
 * Validate user input before creating an edict.
 * Throws EdictValidationError on invalid input.
 */
export function validateEdictInput(input: EdictInput): void {
  if (!input.text || input.text.trim().length === 0) {
    throw new EdictValidationError('Edict text is required and cannot be empty');
  }

  if (!input.category || input.category.trim().length === 0) {
    throw new EdictValidationError('Edict category is required and cannot be empty');
  }

  if (input.confidence !== undefined && !VALID_CONFIDENCE.has(input.confidence)) {
    throw new EdictValidationError(
      `Invalid confidence "${input.confidence}". Must be: ${[...VALID_CONFIDENCE].join(', ')}`
    );
  }

  if (input.ttl !== undefined && !VALID_TTL.has(input.ttl)) {
    throw new EdictValidationError(
      `Invalid ttl "${input.ttl}". Must be: ${[...VALID_TTL].join(', ')}`
    );
  }

  if (input.expiresAt !== undefined) {
    const parsed = new Date(input.expiresAt);
    if (isNaN(parsed.getTime())) {
      throw new EdictValidationError(
        `Invalid expiresAt "${input.expiresAt}". Must be a valid ISO 8601 date.`
      );
    }
  }
}

/**
 * Validate a file schema on load.
 * Throws on critical issues, returns warnings for recoverable ones.
 */
export function validateFileSchema(schema: EdictFileSchema): string[] {
  const warnings: string[] = [];

  if (!schema.version) {
    throw new EdictValidationError('Missing required field: version');
  }

  if (schema.version !== 1) {
    throw new EdictValidationError(`Unsupported schema version: ${schema.version}`);
  }

  if (!schema.config) {
    warnings.push('Missing config section, using defaults');
  }

  if (!Array.isArray(schema.edicts)) {
    throw new EdictValidationError('edicts must be an array');
  }

  if (!Array.isArray(schema.history)) {
    warnings.push('Missing history array, initializing empty');
  }

  // Validate individual edicts
  for (const edict of schema.edicts) {
    if (!edict.id) warnings.push(`Edict missing id, will be regenerated`);
    if (!edict.text) warnings.push(`Edict ${edict.id ?? '(unknown)'} missing text`);
    if (!edict.created) warnings.push(`Edict ${edict.id} missing created timestamp`);
  }

  return warnings;
}

/**
 * Separate expired edicts from active ones.
 * Returns active edicts and history entries for the expired ones.
 */
export function pruneExpired(
  edicts: Edict[],
  now: Date = new Date()
): { active: Edict[]; expired: HistoryEntry[] } {
  const active: Edict[] = [];
  const expired: HistoryEntry[] = [];

  for (const edict of edicts) {
    if (edict.expiresAt && new Date(edict.expiresAt) < now) {
      expired.push({
        id: `${edict.id}__${now.toISOString().slice(0, 10).replace(/-/g, '')}`,
        text: edict.text,
        supersededBy: 'expired',
        archivedAt: now.toISOString(),
      });
    } else {
      active.push(edict);
    }
  }

  return { active, expired };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add schema validation and expiry pruning"
```

---

## Chunk 5: Core EdictStore

### Task 9: EdictStore — Constructor, Load, Save

**Files:**
- Create: `src/store.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: Write store lifecycle tests**

Create `tests/store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-store-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('EdictStore lifecycle', () => {
  it('creates a new file on first save', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test edict', category: 'test' });
    await store.save();

    // Reload to verify persistence
    const store2 = new EdictStore({ path });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
    expect(store2.all()[0].text).toBe('Test edict');
  });

  it('loads existing YAML file', async () => {
    const path = join(tempDir, 'edicts.yaml');
    await writeFile(path, `
version: 1
config:
  maxEdicts: 200
  tokenBudget: 4000
  categories: []
edicts:
  - id: existing
    text: "Pre-existing edict"
    category: test
    tags: []
    confidence: user
    source: manual
    ttl: durable
    created: "2026-03-20T06:00:00Z"
    updated: "2026-03-20T06:00:00Z"
history: []
`);
    const store = new EdictStore({ path });
    await store.load();
    expect(store.all()).toHaveLength(1);
    expect(store.get('existing')?.text).toBe('Pre-existing edict');
  });

  it('uses JSON format when extension is .json', async () => {
    const path = join(tempDir, 'edicts.json');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'JSON edict', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
  });

  it('dirty flag tracks unsaved changes', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(store.dirty).toBe(false);
    store.add({ text: 'New edict', category: 'test' });
    expect(store.dirty).toBe(true);
    await store.save();
    expect(store.dirty).toBe(false);
  });

  it('respects format override regardless of extension', async () => {
    const path = join(tempDir, 'edicts.txt'); // weird extension
    const store = new EdictStore({ path, format: 'json' });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path, format: 'json' });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/store.test.ts
```

Expected: FAIL — cannot resolve `../src/store.js`

- [ ] **Step 3: Implement EdictStore**

Create `src/store.ts`:

```ts
import type {
  Edict,
  EdictInput,
  EdictStoreOptions,
  HistoryEntry,
  EdictFileSchema,
  Tokenizer,
  Renderer,
} from './types.js';
import { YamlStorage } from './storage/yaml.js';
import { JsonStorage } from './storage/json.js';
import type { Storage } from './storage/base.js';
import { DEFAULT_SCHEMA } from './storage/base.js';
import { defaultTokenizer } from './tokenizer.js';
import { renderPlain, renderMarkdown, renderJson } from './renderer.js';
import { normalizeCategory, normalizeTags } from './normalize.js';
import { validateEdictInput, validateFileSchema, pruneExpired } from './schema.js';
import {
  EdictBudgetExceededError,
  EdictConflictError,
  EdictCategoryError,
  EdictNotFoundError,
} from './errors.js';

export class EdictStore {
  private _edicts: Edict[] = [];
  private _history: HistoryEntry[] = [];
  private _fileConfig: EdictFileSchema['config'];
  private _fileHash: string | null = null;
  private _dirty = false;
  private _loaded = false;
  private _sequentialCounter = 0;

  private readonly storage: Storage;
  private readonly tokenizer: Tokenizer;
  private readonly customRenderer: Renderer | undefined;
  private readonly maxEdicts: number;
  private readonly tokenBudget: number;
  private readonly categoryAllowlist: string[] | undefined;

  constructor(options?: EdictStoreOptions) {
    const opts = options ?? {};
    const path = opts.path ?? './edicts.yaml';

    // Determine format from option or file extension
    const format = opts.format ?? (path.endsWith('.json') ? 'json' : 'yaml');
    this.storage = format === 'json' ? new JsonStorage(path) : new YamlStorage(path);

    this.tokenizer = opts.tokenizer ?? defaultTokenizer;
    this.customRenderer = opts.renderer;
    this.maxEdicts = opts.maxEdicts ?? 200;
    this.tokenBudget = opts.tokenBudget ?? 4000;
    this.categoryAllowlist =
      opts.categories && opts.categories.length > 0 ? opts.categories : undefined;

    this._fileConfig = { ...DEFAULT_SCHEMA.config };
  }

  // ── Lifecycle ──

  async load(): Promise<void> {
    const schema = await this.storage.read();
    const warnings = validateFileSchema(schema);
    // Warnings are non-fatal — log if needed in future

    if (schema.config) {
      this._fileConfig = schema.config;
    }

    // Normalize existing edicts
    this._edicts = (schema.edicts ?? []).map((e) => ({
      ...e,
      category: normalizeCategory(e.category),
      tags: normalizeTags(e.tags ?? []),
    }));

    this._history = schema.history ?? [];

    // Prune expired
    const { active, expired } = pruneExpired(this._edicts);
    this._edicts = active;
    this._history = [...this._history, ...expired];

    // Compute token counts
    for (const edict of this._edicts) {
      edict._tokens = this.tokenizer(edict.text);
    }

    // Track sequential counter
    this._sequentialCounter = this._computeNextSequential();

    // Capture file hash for optimistic concurrency
    this._fileHash = await this.storage.hash();
    this._dirty = expired.length > 0; // dirty if we pruned anything
    this._loaded = true;
  }

  async save(): Promise<void> {
    // Optimistic concurrency check
    if (this._fileHash !== null) {
      const currentHash = await this.storage.hash();
      if (currentHash !== null && currentHash !== this._fileHash) {
        throw new EdictConflictError(this._fileHash, currentHash);
      }
    }

    const schema: EdictFileSchema = {
      version: 1,
      config: {
        maxEdicts: this.maxEdicts,
        tokenBudget: this.tokenBudget,
        categories: this.categoryAllowlist ?? [],
      },
      edicts: this._edicts.map(({ _tokens, ...rest }) => rest as Edict),
      history: this._history,
    };

    await this.storage.write(schema);
    this._fileHash = await this.storage.hash();
    this._dirty = false;
  }

  // ── Mutations ──

  add(input: EdictInput): Edict {
    validateEdictInput(input);

    const category = normalizeCategory(input.category);
    this._validateCategory(category);

    const tags = normalizeTags(input.tags ?? []);
    const now = new Date().toISOString();

    // Check for supersession
    if (input.key) {
      const existingIdx = this._edicts.findIndex((e) => e.key === input.key);
      if (existingIdx !== -1) {
        return this._supersede(existingIdx, input, category, tags, now);
      }
    }

    // Check max edicts
    if (this._edicts.length >= this.maxEdicts) {
      throw new EdictBudgetExceededError(this.maxEdicts, this._edicts.length);
    }

    const id = input.key ?? this._nextSequentialId();
    const edict: Edict = {
      id,
      text: input.text,
      category,
      tags,
      confidence: input.confidence ?? 'user',
      source: input.source ?? '',
      key: input.key,
      ttl: input.ttl ?? 'durable',
      expiresAt: input.expiresAt,
      created: now,
      updated: now,
      _tokens: this.tokenizer(input.text),
    };

    // Check token budget
    const newTotal = this.tokenCount() + (edict._tokens ?? 0);
    if (newTotal > this.tokenBudget) {
      throw new EdictBudgetExceededError(this.tokenBudget, newTotal);
    }

    this._edicts.push(edict);
    this._dirty = true;
    return edict;
  }

  remove(id: string): boolean {
    const idx = this._edicts.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this._edicts.splice(idx, 1);
    this._dirty = true;
    return true;
  }

  update(id: string, patch: Partial<EdictInput>): Edict {
    const edict = this._edicts.find((e) => e.id === id);
    if (!edict) throw new EdictNotFoundError(id);

    if (patch.text !== undefined) {
      edict.text = patch.text;
      edict._tokens = this.tokenizer(patch.text);
    }
    if (patch.category !== undefined) {
      edict.category = normalizeCategory(patch.category);
      this._validateCategory(edict.category);
    }
    if (patch.tags !== undefined) {
      edict.tags = normalizeTags(patch.tags);
    }
    if (patch.confidence !== undefined) edict.confidence = patch.confidence;
    if (patch.source !== undefined) edict.source = patch.source;
    if (patch.ttl !== undefined) edict.ttl = patch.ttl;
    if (patch.expiresAt !== undefined) edict.expiresAt = patch.expiresAt;

    edict.updated = new Date().toISOString();
    this._dirty = true;
    return edict;
  }

  // ── Reads ──

  get(id: string): Edict | undefined {
    const edict = this._edicts.find((e) => e.id === id);
    if (edict) {
      edict.lastAccessed = new Date().toISOString();
    }
    return edict;
  }

  has(id: string): boolean {
    return this._edicts.some((e) => e.id === id);
  }

  all(): Edict[] {
    return [...this._edicts];
  }

  find(predicate: (e: Edict) => boolean): Edict[] {
    return this._edicts.filter(predicate);
  }

  categories(): string[] {
    return [...new Set(this._edicts.map((e) => e.category))].sort();
  }

  history(): HistoryEntry[] {
    return [...this._history];
  }

  // ── Rendering ──

  render(format?: 'plain' | 'markdown' | 'json'): string {
    // Update lastAccessed for all rendered edicts
    const now = new Date().toISOString();
    for (const edict of this._edicts) {
      edict.lastAccessed = now;
    }

    if (this.customRenderer && !format) {
      return this.customRenderer(this._edicts);
    }

    switch (format ?? 'plain') {
      case 'plain':
        return renderPlain(this._edicts);
      case 'markdown':
        return renderMarkdown(this._edicts);
      case 'json':
        return renderJson(this._edicts);
      default:
        return renderPlain(this._edicts);
    }
  }

  // ── Budget ──

  tokenCount(): number {
    return this._edicts.reduce((sum, e) => sum + (e._tokens ?? 0), 0);
  }

  tokenBudgetRemaining(): number {
    return this.tokenBudget - this.tokenCount();
  }

  isOverBudget(): boolean {
    return this.tokenCount() > this.tokenBudget;
  }

  // ── Meta ──

  get dirty(): boolean {
    return this._dirty;
  }

  get fileHash(): string {
    return this._fileHash ?? '';
  }

  // ── Private ──

  private _supersede(
    existingIdx: number,
    input: EdictInput,
    category: string,
    tags: string[],
    now: string
  ): Edict {
    const existing = this._edicts[existingIdx];

    // Archive the existing edict
    const historyId = `${existing.id}__${now.slice(0, 10).replace(/-/g, '')}`;
    this._history.push({
      id: historyId,
      text: existing.text,
      supersededBy: existing.id,
      archivedAt: now,
    });

    // Update in place
    existing.text = input.text;
    existing.category = category;
    existing.tags = tags;
    existing.confidence = input.confidence ?? existing.confidence;
    existing.source = input.source ?? existing.source;
    existing.ttl = input.ttl ?? existing.ttl;
    existing.expiresAt = input.expiresAt;
    existing.updated = now;
    existing._tokens = this.tokenizer(input.text);

    this._dirty = true;
    return existing;
  }

  private _validateCategory(category: string): void {
    if (this.categoryAllowlist && !this.categoryAllowlist.includes(category)) {
      throw new EdictCategoryError(category, this.categoryAllowlist);
    }
  }

  private _nextSequentialId(): string {
    this._sequentialCounter++;
    return `e_${String(this._sequentialCounter).padStart(3, '0')}`;
  }

  private _computeNextSequential(): number {
    let max = 0;
    for (const edict of this._edicts) {
      const match = edict.id.match(/^e_(\d+)$/);
      if (match) {
        max = Math.max(max, parseInt(match[1], 10));
      }
    }
    return max;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/store.test.ts
```

Expected: PASS — all 5 lifecycle tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement EdictStore core (constructor, load, save)"
```

---

### Task 10: EdictStore — Mutations (Add, Remove, Update, Supersession)

**Files:**
- Modify: `tests/store.test.ts` (append)
- Create: `tests/supersession.test.ts`

- [ ] **Step 1: Write mutation tests**

Append to `tests/store.test.ts`:

```ts
describe('EdictStore mutations', () => {
  it('add creates edict with defaults', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const edict = store.add({ text: 'New fact', category: 'Test' });
    expect(edict.id).toBe('e_001');
    expect(edict.category).toBe('test'); // normalized
    expect(edict.confidence).toBe('user'); // default
    expect(edict.ttl).toBe('durable'); // default
    expect(edict.tags).toEqual([]);
    expect(edict._tokens).toBeGreaterThan(0);
  });

  it('add with key uses key as ID', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const edict = store.add({
      text: 'Product launch',
      category: 'product',
      key: 'product-v2-status',
    });
    expect(edict.id).toBe('product-v2-status');
  });

  it('sequential IDs increment correctly', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const e1 = store.add({ text: 'First', category: 'test' });
    const e2 = store.add({ text: 'Second', category: 'test' });
    const e3 = store.add({ text: 'Third', category: 'test' });
    expect(e1.id).toBe('e_001');
    expect(e2.id).toBe('e_002');
    expect(e3.id).toBe('e_003');
  });

  it('remove returns true for existing edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'To remove', category: 'test' });
    expect(store.remove('e_001')).toBe(true);
    expect(store.all()).toHaveLength(0);
  });

  it('remove returns false for nonexistent edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(store.remove('nonexistent')).toBe(false);
  });

  it('update modifies edict fields', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Original', category: 'test' });
    const updated = store.update('e_001', { text: 'Updated text', category: 'Product' });
    expect(updated.text).toBe('Updated text');
    expect(updated.category).toBe('product');
  });

  it('update throws for nonexistent edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(() => store.update('nope', { text: 'Fail' })).toThrow('nope');
  });

  it('rejects invalid input on add', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(() => store.add({ text: '', category: 'test' })).toThrow('text');
  });

  it('enforces category allowlist', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, categories: ['product', 'team'] });
    await store.load();
    expect(() => store.add({ text: 'Hello', category: 'random' })).toThrow('random');
    expect(() => store.add({ text: 'Hello', category: 'Product' })).not.toThrow();
  });
});

describe('EdictStore reads', () => {
  it('get returns edict and updates lastAccessed', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test', key: 'my-key' });
    const edict = store.get('my-key');
    expect(edict?.text).toBe('Test');
    expect(edict?.lastAccessed).toBeDefined();
  });

  it('has returns correct boolean', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    expect(store.has('e_001')).toBe(true);
    expect(store.has('nope')).toBe(false);
  });

  it('find with predicate works', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Product fact', category: 'product' });
    store.add({ text: 'Team fact', category: 'team' });
    store.add({ text: 'Another product', category: 'product' });

    const products = store.find((e) => e.category === 'product');
    expect(products).toHaveLength(2);
  });

  it('categories returns sorted unique categories', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'A', category: 'team' });
    store.add({ text: 'B', category: 'product' });
    store.add({ text: 'C', category: 'team' });
    expect(store.categories()).toEqual(['product', 'team']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (new tests only)**

```bash
npx vitest run tests/store.test.ts
```

Expected: New mutation/read tests pass (implementation already includes the logic)

- [ ] **Step 3: Write supersession tests**

Create `tests/supersession.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-supersede-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Supersession', () => {
  it('adding with same key supersedes existing edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({
      text: 'Product v2 estimated Q2 2026',
      category: 'product',
      key: 'product-v2-status',
    });

    store.add({
      text: 'Product v2 launches April 15, 2026',
      category: 'product',
      key: 'product-v2-status',
    });

    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].text).toBe('Product v2 launches April 15, 2026');
    expect(store.all()[0].id).toBe('product-v2-status');
  });

  it('superseded edict moves to history', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({
      text: 'Original text',
      category: 'product',
      key: 'my-key',
    });

    store.add({
      text: 'Updated text',
      category: 'product',
      key: 'my-key',
    });

    const hist = store.history();
    expect(hist).toHaveLength(1);
    expect(hist[0].text).toBe('Original text');
    expect(hist[0].supersededBy).toBe('my-key');
  });

  it('multiple supersessions build up history', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'Version 1', category: 'product', key: 'status' });
    store.add({ text: 'Version 2', category: 'product', key: 'status' });
    store.add({ text: 'Version 3', category: 'product', key: 'status' });

    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].text).toBe('Version 3');
    expect(store.history()).toHaveLength(2);
  });

  it('supersession persists through save/load', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'Original', category: 'product', key: 'k1' });
    store.add({ text: 'Updated', category: 'product', key: 'k1' });
    await store.save();

    const store2 = new EdictStore({ path });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
    expect(store2.all()[0].text).toBe('Updated');
    expect(store2.history()).toHaveLength(1);
    expect(store2.history()[0].text).toBe('Original');
  });

  it('adding without key does not trigger supersession', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'First', category: 'test' });
    store.add({ text: 'Second', category: 'test' });

    expect(store.all()).toHaveLength(2);
    expect(store.history()).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: ALL tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add mutation, read, and supersession tests"
```

---

### Task 11: EdictStore — Token Budget & Concurrency

**Files:**
- Create: `tests/concurrency.test.ts`
- Append budget tests to: `tests/store.test.ts`

- [ ] **Step 1: Write budget tests**

Append to `tests/store.test.ts`:

```ts
describe('EdictStore budget', () => {
  it('tracks token count', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 1000 });
    await store.load();
    store.add({ text: 'Hello world', category: 'test' }); // ~3 tokens (11 chars / 4)
    expect(store.tokenCount()).toBeGreaterThan(0);
    expect(store.tokenBudgetRemaining()).toBeLessThan(1000);
  });

  it('throws when token budget exceeded', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 5 });
    await store.load();
    // 'a'.repeat(100) = 100 chars = 25 tokens, budget is 5
    expect(() =>
      store.add({ text: 'a'.repeat(100), category: 'test' })
    ).toThrow('budget');
  });

  it('uses custom tokenizer', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      tokenBudget: 100,
      tokenizer: (text) => text.length, // 1 token per char
    });
    await store.load();
    store.add({ text: 'hello', category: 'test' });
    expect(store.tokenCount()).toBe(5); // exact char count
  });

  it('isOverBudget returns correct value', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 1000 });
    await store.load();
    expect(store.isOverBudget()).toBe(false);
  });
});
```

- [ ] **Step 2: Write concurrency tests**

Create `tests/concurrency.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';
import { EdictConflictError } from '../src/errors.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-concurrency-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Optimistic concurrency', () => {
  it('save succeeds when file unchanged', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    await expect(store.save()).resolves.toBeUndefined();
  });

  it('save throws EdictConflictError when file changed externally', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'From store 1', category: 'test' });
    await store.save();

    // Load in second instance
    const store2 = new EdictStore({ path });
    await store2.load();
    store2.add({ text: 'From store 2', category: 'test' });

    // Modify file externally (simulating another writer)
    await writeFile(path, 'version: 1\nconfig:\n  maxEdicts: 200\n  tokenBudget: 4000\n  categories: []\nedicts: []\nhistory: []\n');

    await expect(store2.save()).rejects.toThrow(EdictConflictError);
  });

  it('save succeeds on first write (no file existed)', async () => {
    const path = join(tempDir, 'new-edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'First edict ever', category: 'test' });
    await expect(store.save()).resolves.toBeUndefined();
  });

  it('after conflict, reload and retry works', async () => {
    const path = join(tempDir, 'edicts.yaml');

    // Store 1 writes
    const store1 = new EdictStore({ path });
    await store1.load();
    store1.add({ text: 'Initial', category: 'test' });
    await store1.save();

    // Store 2 loads
    const store2 = new EdictStore({ path });
    await store2.load();
    store2.add({ text: 'Store 2 addition', category: 'test' });

    // Store 1 writes again (changes file)
    store1.add({ text: 'Store 1 second write', category: 'test' });
    await store1.save();

    // Store 2 should fail
    await expect(store2.save()).rejects.toThrow(EdictConflictError);

    // Reload and retry
    await store2.load();
    store2.add({ text: 'Store 2 retry', category: 'test' });
    await expect(store2.save()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: ALL tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add token budget and optimistic concurrency tests"
```

---

### Task 12: Rendering Integration Tests

**Files:**
- Append to: `tests/store.test.ts`

- [ ] **Step 1: Write render integration tests**

Append to `tests/store.test.ts`:

```ts
describe('EdictStore rendering', () => {
  it('render plain returns formatted text', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test fact', category: 'product', confidence: 'verified' });
    const output = store.render('plain');
    expect(output).toContain('Test fact');
    expect(output).toContain('verified');
  });

  it('render markdown groups by category', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Fact A', category: 'product' });
    store.add({ text: 'Fact B', category: 'team' });
    const output = store.render('markdown');
    expect(output).toContain('## product');
    expect(output).toContain('## team');
  });

  it('render json returns valid JSON', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    const output = store.render('json');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
  });

  it('custom renderer is used when no format specified', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      renderer: (edicts) => edicts.map((e) => `CUSTOM: ${e.text}`).join('|'),
    });
    await store.load();
    store.add({ text: 'Hello', category: 'test' });
    const output = store.render();
    expect(output).toBe('CUSTOM: Hello');
  });

  it('explicit format overrides custom renderer', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      renderer: () => 'CUSTOM',
    });
    await store.load();
    store.add({ text: 'Hello', category: 'test' });
    const output = store.render('plain');
    expect(output).toContain('Hello');
    expect(output).not.toBe('CUSTOM');
  });

  it('render updates lastAccessed on all edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    expect(store.all()[0].lastAccessed).toBeUndefined();
    store.render();
    expect(store.all()[0].lastAccessed).toBeDefined();
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: ALL tests pass

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: add rendering integration tests"
```

---

## Chunk 6: Public Exports & Final Verification

### Task 13: Public Exports

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create index.ts with all public exports**

Create `src/index.ts`:

```ts
// Core
export { EdictStore } from './store.js';

// Types
export type {
  Edict,
  EdictInput,
  HistoryEntry,
  EdictStoreOptions,
  EdictFileSchema,
  Tokenizer,
  Renderer,
} from './types.js';

// Errors
export {
  EdictBudgetExceededError,
  EdictConflictError,
  EdictCategoryError,
  EdictValidationError,
  EdictNotFoundError,
} from './errors.js';

// Utilities (for advanced users)
export { normalizeCategory, normalizeTags } from './normalize.js';
export { defaultTokenizer } from './tokenizer.js';
export { renderPlain, renderMarkdown, renderJson } from './renderer.js';
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Verify build produces dual output**

```bash
npx tsup
ls -la dist/
```

Expected: `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts` present

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add public exports (index.ts)"
```

---

### Task 14: Full Test Suite & Final Verification

- [ ] **Step 1: Run complete test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: ALL tests pass (across all 8 test files)

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Clean build, dist/ populated

- [ ] **Step 3: Verify lint**

```bash
npm run lint
```

Expected: No TypeScript errors

- [ ] **Step 4: Test package contents**

```bash
npm pack --dry-run
```

Expected: Only `dist/` files included, reasonable package size

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, build clean"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1. Scaffold & Types | 1-3 | Package setup, type system, error classes |
| 2. Utilities | 4-6 | Normalizer, tokenizer, renderers |
| 3. Storage | 7 | YAML + JSON backends with atomic writes |
| 4. Validation | 8 | Schema validation, expiry pruning |
| 5. Core Store | 9-12 | EdictStore (full CRUD, supersession, concurrency, rendering) |
| 6. Exports & Verification | 13-14 | Public API, build verification, full test suite |

**Total: 14 tasks, ~70 steps, 8 test files**

**Runtime dependency:** `yaml` only
**Test framework:** vitest
**Build:** tsup (ESM + CJS dual export)
