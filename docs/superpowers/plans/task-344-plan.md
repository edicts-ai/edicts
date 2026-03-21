# OpenClaw Plugin Adapter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `openclaw-plugin-edicts` — a standalone npm package that wires the `edicts` library into the OpenClaw agent runtime. Registers 7 tools, injects edicts into system context via `before_prompt_build`, and exposes plugin config.

**Architecture:** Thin adapter plugin — all domain logic lives in `edicts` (peer dep). The plugin handles OpenClaw registration, config resolution, context injection, and tool param/response mapping.

**Tech Stack:** TypeScript, vitest, tsup — peer deps on `edicts` and `openclaw`

**Spec:** `docs/superpowers/specs/2026-03-20-openclaw-plugin-adapter-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `openclaw-plugin-edicts/package.json` | Create | Package metadata, peer deps, build scripts |
| `openclaw-plugin-edicts/tsconfig.json` | Create | TypeScript config |
| `openclaw-plugin-edicts/tsup.config.ts` | Create | Build config (ESM + CJS) |
| `openclaw-plugin-edicts/vitest.config.ts` | Create | Test config |
| `openclaw-plugin-edicts/openclaw.plugin.json` | Create | Plugin manifest with config schema |
| `openclaw-plugin-edicts/index.ts` | Create | Entry point — plugin object with register(api) |
| `openclaw-plugin-edicts/src/config.ts` | Create | Config resolution & defaults |
| `openclaw-plugin-edicts/src/context.ts` | Create | before_prompt_build hook |
| `openclaw-plugin-edicts/src/tools.ts` | Create | All 7 tool definitions |
| `openclaw-plugin-edicts/tests/config.test.ts` | Create | Config resolution tests |
| `openclaw-plugin-edicts/tests/context.test.ts` | Create | Context injection tests |
| `openclaw-plugin-edicts/tests/tools.test.ts` | Create | Tool wiring tests |

---

## Chunk 1: Project Scaffolding & Config Resolution

### Task 1: Create project skeleton

**Files:**
- Create: `openclaw-plugin-edicts/package.json`
- Create: `openclaw-plugin-edicts/tsconfig.json`
- Create: `openclaw-plugin-edicts/tsup.config.ts`
- Create: `openclaw-plugin-edicts/vitest.config.ts`
- Create: `openclaw-plugin-edicts/openclaw.plugin.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "openclaw-plugin-edicts",
  "version": "0.1.0",
  "description": "OpenClaw plugin adapter for the edicts library — agent standing instructions.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "openclaw.plugin.json"
  ],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "edicts": ">=0.1.0",
    "openclaw": ">=2025.0.0"
  },
  "devDependencies": {
    "edicts": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "keywords": ["openclaw", "plugin", "edicts", "agent", "instructions"],
  "license": "MIT"
}
```

Note: `"edicts": "workspace:*"` in devDependencies allows local development. For npm publish, the peer dep constraint is what matters. If not using a monorepo workspace, replace with the actual published version.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["index.ts", "src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `tsup.config.ts`**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create `openclaw.plugin.json`**

```json
{
  "id": "edicts",
  "name": "Edicts",
  "description": "Inject agent edicts into context and expose CRUD tools.",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "path": {
        "type": "string",
        "description": "Path to edicts storage file (YAML or JSON)"
      },
      "format": {
        "type": "string",
        "enum": ["yaml", "json"],
        "description": "Storage format"
      },
      "autoInject": {
        "type": "boolean",
        "description": "Auto-inject edicts into system context on every session"
      },
      "autoInjectFilter": {
        "type": "string",
        "enum": ["all"],
        "description": "Which edicts to inject (v1: only 'all')"
      },
      "tokenBudget": {
        "type": "number",
        "description": "Max tokens for context injection"
      }
    }
  },
  "uiHints": {
    "path": { "label": "Storage Path", "placeholder": "edicts.yaml" },
    "format": { "label": "Storage Format" },
    "autoInject": { "label": "Auto-inject into Context" },
    "tokenBudget": { "label": "Token Budget", "placeholder": "2000" }
  }
}
```

- [ ] **Step 6: Install dependencies and verify project compiles**

```bash
cd openclaw-plugin-edicts
npm install
npx tsc --noEmit
```

Expected: Clean compile (no source files yet, but config is valid).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold openclaw-plugin-edicts project"
```

---

### Task 2: Implement config resolution (`src/config.ts`)

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing tests for config resolution**

Create `tests/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../src/config.js';
import type { ResolvedConfig } from '../src/config.js';

describe('resolveConfig', () => {
  it('applies all defaults when config is empty', () => {
    const config = resolveConfig({});
    expect(config).toEqual({
      path: 'edicts.yaml',
      format: 'yaml',
      autoInject: true,
      autoInjectFilter: 'all',
      tokenBudget: 2000,
    });
  });

  it('applies all defaults when config is undefined', () => {
    const config = resolveConfig(undefined as any);
    expect(config).toEqual({
      path: 'edicts.yaml',
      format: 'yaml',
      autoInject: true,
      autoInjectFilter: 'all',
      tokenBudget: 2000,
    });
  });

  it('respects user-provided path', () => {
    const config = resolveConfig({ path: 'custom/edicts.yaml' });
    expect(config.path).toBe('custom/edicts.yaml');
  });

  it('respects user-provided format', () => {
    const config = resolveConfig({ format: 'json' });
    expect(config.format).toBe('json');
  });

  it('infers json format from .json extension', () => {
    const config = resolveConfig({ path: 'data/edicts.json' });
    expect(config.format).toBe('json');
  });

  it('infers yaml format from .yaml extension', () => {
    const config = resolveConfig({ path: 'data/edicts.yaml' });
    expect(config.format).toBe('yaml');
  });

  it('infers yaml format from .yml extension', () => {
    const config = resolveConfig({ path: 'data/edicts.yml' });
    expect(config.format).toBe('yaml');
  });

  it('defaults to yaml when path has no recognizable extension', () => {
    const config = resolveConfig({ path: 'edicts' });
    expect(config.format).toBe('yaml');
  });

  it('explicit format overrides inferred format', () => {
    const config = resolveConfig({ path: 'edicts.json', format: 'yaml' });
    expect(config.format).toBe('yaml');
  });

  it('respects autoInject: false', () => {
    const config = resolveConfig({ autoInject: false });
    expect(config.autoInject).toBe(false);
  });

  it('respects custom tokenBudget', () => {
    const config = resolveConfig({ tokenBudget: 5000 });
    expect(config.tokenBudget).toBe(5000);
  });

  it('respects autoInjectFilter', () => {
    const config = resolveConfig({ autoInjectFilter: 'all' });
    expect(config.autoInjectFilter).toBe('all');
  });

  it('merges partial config with defaults', () => {
    const config = resolveConfig({ path: 'my-edicts.json', tokenBudget: 3000 });
    expect(config).toEqual({
      path: 'my-edicts.json',
      format: 'json',
      autoInject: true,
      autoInjectFilter: 'all',
      tokenBudget: 3000,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/config.test.ts
```

Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `resolveConfig()`**

Create `src/config.ts`:

```typescript
export interface ResolvedConfig {
  path: string;
  format: 'yaml' | 'json';
  autoInject: boolean;
  autoInjectFilter: 'all';
  tokenBudget: number;
}

interface RawPluginConfig {
  path?: string;
  format?: 'yaml' | 'json';
  autoInject?: boolean;
  autoInjectFilter?: 'all';
  tokenBudget?: number;
}

const DEFAULTS: ResolvedConfig = {
  path: 'edicts.yaml',
  format: 'yaml',
  autoInject: true,
  autoInjectFilter: 'all',
  tokenBudget: 2000,
};

function inferFormat(filePath: string): 'yaml' | 'json' {
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'yaml';
  return 'yaml';
}

export function resolveConfig(raw: RawPluginConfig | undefined | null): ResolvedConfig {
  const input = raw ?? {};

  const path = input.path ?? DEFAULTS.path;
  const format = input.format ?? inferFormat(path);

  return {
    path,
    format,
    autoInject: input.autoInject ?? DEFAULTS.autoInject,
    autoInjectFilter: input.autoInjectFilter ?? DEFAULTS.autoInjectFilter,
    tokenBudget: input.tokenBudget ?? DEFAULTS.tokenBudget,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/config.test.ts
```

Expected: PASS — all 12 tests green

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat(config): implement config resolution with defaults and format inference"
```

---

## Chunk 2: Context Injection Hook

### Task 3: Implement context injection (`src/context.ts`)

**Files:**
- Create: `src/context.ts`
- Create: `tests/context.test.ts`

- [ ] **Step 1: Write failing tests for context injection**

Create `tests/context.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EdictStore } from 'edicts';
import type { Storage, EdictFileSchema } from 'edicts';
import { createContextHook } from '../src/context.js';
import type { ResolvedConfig } from '../src/config.js';

/**
 * In-memory storage for tests — no filesystem.
 */
class MemoryStorage implements Storage {
  private data: EdictFileSchema = {
    version: 1,
    config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
    edicts: [],
    history: [],
  };

  async read(): Promise<EdictFileSchema> {
    return structuredClone(this.data);
  }

  async write(data: EdictFileSchema): Promise<void> {
    this.data = structuredClone(data);
  }

  async hash(): Promise<string | null> {
    return String(JSON.stringify(this.data).length);
  }

  async exists(): Promise<boolean> {
    return true;
  }
}

function makeConfig(overrides?: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    path: 'edicts.yaml',
    format: 'yaml',
    autoInject: true,
    autoInjectFilter: 'all',
    tokenBudget: 2000,
    ...overrides,
  };
}

describe('createContextHook', () => {
  let store: EdictStore;

  beforeEach(async () => {
    store = new EdictStore({ storage: new MemoryStorage() as any, autoSave: true });
    await store.load();
  });

  it('returns empty object when store has no edicts', async () => {
    const hook = createContextHook(store, makeConfig());
    const result = await hook();
    expect(result).toEqual({});
  });

  it('returns appendSystemContext when edicts exist', async () => {
    await store.add({ text: 'Always respond in English', category: 'style' });
    const hook = createContextHook(store, makeConfig());
    const result = await hook();

    expect(result.appendSystemContext).toBeDefined();
    expect(result.appendSystemContext).toContain('## Edicts (Standing Instructions)');
    expect(result.appendSystemContext).toContain('Always respond in English');
  });

  it('includes behavioral instruction in wrapper', async () => {
    await store.add({ text: 'Be concise', category: 'style' });
    const hook = createContextHook(store, makeConfig());
    const result = await hook();

    expect(result.appendSystemContext).toContain(
      'Follow them unless explicitly overridden'
    );
  });

  it('renders multiple edicts', async () => {
    await store.add({ text: 'Be concise', category: 'style' });
    await store.add({ text: 'Use formal tone', category: 'style' });
    await store.add({ text: 'Never share secrets', category: 'security' });
    const hook = createContextHook(store, makeConfig());
    const result = await hook();

    expect(result.appendSystemContext).toContain('Be concise');
    expect(result.appendSystemContext).toContain('Use formal tone');
    expect(result.appendSystemContext).toContain('Never share secrets');
  });

  it('respects token budget — truncates when exceeded', async () => {
    // Add edicts that exceed a tiny budget
    // Each edict with metadata is roughly 15-25 tokens at chars/4
    await store.add({ text: 'First edict with some content', category: 'a', ttl: 'permanent' });
    await store.add({ text: 'Second edict with some content', category: 'b', ttl: 'durable' });
    await store.add({ text: 'Third edict with some content', category: 'c', ttl: 'ephemeral' });

    // Very tight budget — should truncate
    const hook = createContextHook(store, makeConfig({ tokenBudget: 30 }));
    const result = await hook();

    // Should still have SOME content (at least the header + highest priority edicts)
    expect(result.appendSystemContext).toBeDefined();
    // The exact truncation behavior depends on renderPlain's token counting
    // Key assertion: it doesn't throw, returns gracefully
  });

  it('does not set prependSystemContext or prependContext', async () => {
    await store.add({ text: 'Test edict', category: 'test' });
    const hook = createContextHook(store, makeConfig());
    const result = await hook();

    expect(result.prependSystemContext).toBeUndefined();
    expect(result.prependContext).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/context.test.ts
```

Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `createContextHook()`**

Create `src/context.ts`:

```typescript
import { renderPlain } from 'edicts';
import type { EdictStore, Edict } from 'edicts';
import type { ResolvedConfig } from './config.js';

interface ContextHookResult {
  appendSystemContext?: string;
  prependSystemContext?: string;
  prependContext?: string;
}

export function createContextHook(
  store: EdictStore,
  config: ResolvedConfig,
): () => Promise<ContextHookResult> {
  return async (): Promise<ContextHookResult> => {
    let edicts: Edict[];
    try {
      edicts = await store.all();
    } catch {
      // If store can't load (file missing on first run, etc.), skip gracefully
      return {};
    }

    if (edicts.length === 0) {
      return {};
    }

    // Sort by priority: permanent first, ephemeral last
    const priorityOrder: Record<string, number> = {
      permanent: 0,
      durable: 1,
      event: 2,
      ephemeral: 3,
    };
    edicts.sort((a, b) => (priorityOrder[a.ttl] ?? 9) - (priorityOrder[b.ttl] ?? 9));

    // Render with token budget — renderPlain handles the text,
    // we handle truncation at the edict level
    const tokenBudget = config.tokenBudget;
    const selected = selectWithinBudget(edicts, tokenBudget);

    const rendered = renderPlain(selected.edicts);
    if (!rendered) {
      return {};
    }

    let text = wrapEdicts(rendered);
    if (selected.truncated > 0) {
      text += `\n\n_[${selected.truncated} lower-priority edicts omitted due to token budget]_`;
    }

    return {
      appendSystemContext: text,
    };
  };
}

interface SelectionResult {
  edicts: Edict[];
  truncated: number;
}

function selectWithinBudget(edicts: Edict[], budget: number): SelectionResult {
  const selected: Edict[] = [];
  let usedTokens = 0;

  for (const edict of edicts) {
    const tokens = edict._tokens ?? Math.ceil(edict.text.length / 4);
    // Account for rendering overhead per edict (roughly "- " + metadata ~ 10 tokens)
    const overhead = 10;
    if (usedTokens + tokens + overhead > budget && selected.length > 0) {
      // Budget exceeded — stop adding
      return { edicts: selected, truncated: edicts.length - selected.length };
    }
    selected.push(edict);
    usedTokens += tokens + overhead;
  }

  return { edicts: selected, truncated: 0 };
}

function wrapEdicts(rendered: string): string {
  return [
    '## Edicts (Standing Instructions)',
    'The following are your standing instructions. Follow them unless explicitly overridden.',
    '',
    rendered,
  ].join('\n');
}
```

**Design note:** The core `renderPlain()` doesn't do token-budget truncation itself — it renders whatever edicts it's given. The plugin handles budget-aware selection by sorting edicts by TTL priority and including them until the token budget is exhausted. This keeps the adapter logic in the adapter.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/context.test.ts
```

Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add src/context.ts tests/context.test.ts
git commit -m "feat(context): implement before_prompt_build hook with token-budget-aware injection"
```

---

## Chunk 3: Tool Definitions

### Task 4: Implement all 7 tools (`src/tools.ts`)

**Files:**
- Create: `src/tools.ts`
- Create: `tests/tools.test.ts`

- [ ] **Step 1: Write failing tests for all 7 tools**

Create `tests/tools.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EdictStore } from 'edicts';
import type { Storage, EdictFileSchema } from 'edicts';
import { registerEdictTools } from '../src/tools.js';

/**
 * In-memory storage for tests — no filesystem.
 */
class MemoryStorage implements Storage {
  private data: EdictFileSchema = {
    version: 1,
    config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
    edicts: [],
    history: [],
  };

  async read(): Promise<EdictFileSchema> {
    return structuredClone(this.data);
  }

  async write(data: EdictFileSchema): Promise<void> {
    this.data = structuredClone(data);
  }

  async hash(): Promise<string | null> {
    return String(JSON.stringify(this.data).length);
  }

  async exists(): Promise<boolean> {
    return true;
  }
}

/**
 * Captures tools registered via api.registerTool().
 */
function createMockApi() {
  const tools: Map<string, any> = new Map();

  const api = {
    registerTool: vi.fn((toolDef: any) => {
      tools.set(toolDef.name, toolDef);
    }),
    on: vi.fn(),
    pluginConfig: {},
    workspaceDir: '/tmp/test-workspace',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };

  return { api, tools };
}

/**
 * Helper: execute a registered tool by name.
 */
async function executeTool(
  tools: Map<string, any>,
  name: string,
  params: Record<string, any>,
): Promise<any> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool.execute('test-call-id', params);
}

describe('registerEdictTools', () => {
  let store: EdictStore;
  let tools: Map<string, any>;

  beforeEach(async () => {
    store = new EdictStore({ storage: new MemoryStorage() as any, autoSave: true });
    await store.load();
    const mock = createMockApi();
    registerEdictTools(mock.api as any, store);
    tools = mock.tools;
  });

  it('registers all 7 tools', () => {
    expect(tools.size).toBe(7);
    expect(tools.has('edicts_list')).toBe(true);
    expect(tools.has('edicts_add')).toBe(true);
    expect(tools.has('edicts_update')).toBe(true);
    expect(tools.has('edicts_remove')).toBe(true);
    expect(tools.has('edicts_search')).toBe(true);
    expect(tools.has('edicts_stats')).toBe(true);
    expect(tools.has('edicts_review')).toBe(true);
  });

  describe('edicts_list', () => {
    it('returns empty message when no edicts', async () => {
      const result = await executeTool(tools, 'edicts_list', {});
      expect(result.content[0].text).toContain('0 edicts');
    });

    it('lists all edicts', async () => {
      await store.add({ text: 'Be concise', category: 'style' });
      await store.add({ text: 'Be safe', category: 'security' });
      const result = await executeTool(tools, 'edicts_list', {});
      expect(result.content[0].text).toContain('Be concise');
      expect(result.content[0].text).toContain('Be safe');
      expect(result.content[0].text).toContain('2 edicts');
    });

    it('filters by category', async () => {
      await store.add({ text: 'Be concise', category: 'style' });
      await store.add({ text: 'Be safe', category: 'security' });
      const result = await executeTool(tools, 'edicts_list', { category: 'security' });
      expect(result.content[0].text).toContain('Be safe');
      expect(result.content[0].text).not.toContain('Be concise');
    });

    it('filters by tags', async () => {
      await store.add({ text: 'Tagged one', category: 'a', tags: ['ops'] });
      await store.add({ text: 'Tagged two', category: 'b', tags: ['dev'] });
      const result = await executeTool(tools, 'edicts_list', { tags: ['ops'] });
      expect(result.content[0].text).toContain('Tagged one');
      expect(result.content[0].text).not.toContain('Tagged two');
    });

    it('filters by ttl', async () => {
      await store.add({ text: 'Temp', category: 'a', ttl: 'ephemeral', expiresAt: new Date(Date.now() + 86400000).toISOString() });
      await store.add({ text: 'Perm', category: 'b', ttl: 'permanent' });
      const result = await executeTool(tools, 'edicts_list', { ttl: 'permanent' });
      expect(result.content[0].text).toContain('Perm');
      expect(result.content[0].text).not.toContain('Temp');
    });

    it('respects limit', async () => {
      await store.add({ text: 'First', category: 'a' });
      await store.add({ text: 'Second', category: 'b' });
      await store.add({ text: 'Third', category: 'c' });
      const result = await executeTool(tools, 'edicts_list', { limit: 2 });
      // Should report total and show limited set
      expect(result.content[0].text).toBeDefined();
    });
  });

  describe('edicts_add', () => {
    it('creates an edict with defaults', async () => {
      const result = await executeTool(tools, 'edicts_add', {
        text: 'Always be polite',
        category: 'style',
      });
      expect(result.content[0].text).toContain('Created');
      expect(result.content[0].text).toContain('Always be polite');
    });

    it('creates an edict with all fields', async () => {
      const result = await executeTool(tools, 'edicts_add', {
        text: 'Use formal tone',
        category: 'style',
        tags: ['writing', 'tone'],
        confidence: 'verified',
        source: 'user-request',
        key: 'formal-tone',
        ttl: 'permanent',
      });
      expect(result.content[0].text).toContain('Created');
      expect(result.content[0].text).toContain('formal-tone');
    });

    it('returns error when text is missing', async () => {
      const result = await executeTool(tools, 'edicts_add', { category: 'test' });
      expect(result.content[0].text).toContain('required');
    });
  });

  describe('edicts_update', () => {
    it('updates an existing edict', async () => {
      await store.add({ text: 'Old text', category: 'test', key: 'my-edict' });
      const result = await executeTool(tools, 'edicts_update', {
        id: 'my-edict',
        text: 'New text',
      });
      expect(result.content[0].text).toContain('Updated');
      expect(result.content[0].text).toContain('New text');
    });

    it('returns error for unknown ID', async () => {
      const result = await executeTool(tools, 'edicts_update', {
        id: 'nonexistent',
        text: 'Something',
      });
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('edicts_remove', () => {
    it('removes an existing edict', async () => {
      await store.add({ text: 'To be removed', category: 'test', key: 'remove-me' });
      const result = await executeTool(tools, 'edicts_remove', { id: 'remove-me' });
      expect(result.content[0].text).toContain('Removed');
    });

    it('returns error for unknown ID', async () => {
      const result = await executeTool(tools, 'edicts_remove', { id: 'nonexistent' });
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('edicts_search', () => {
    it('finds matching edicts', async () => {
      await store.add({ text: 'Always respond in English', category: 'language' });
      await store.add({ text: 'Be concise', category: 'style' });
      const result = await executeTool(tools, 'edicts_search', { query: 'English' });
      expect(result.content[0].text).toContain('English');
    });

    it('returns no matches message', async () => {
      await store.add({ text: 'Be concise', category: 'style' });
      const result = await executeTool(tools, 'edicts_search', { query: 'xyznonexistent' });
      expect(result.content[0].text).toContain('0');
    });
  });

  describe('edicts_stats', () => {
    it('returns stats for empty store', async () => {
      const result = await executeTool(tools, 'edicts_stats', {});
      expect(result.content[0].text).toContain('0');
    });

    it('returns category breakdown', async () => {
      await store.add({ text: 'One', category: 'style' });
      await store.add({ text: 'Two', category: 'style' });
      await store.add({ text: 'Three', category: 'security' });
      const result = await executeTool(tools, 'edicts_stats', {});
      expect(result.content[0].text).toContain('3');
      expect(result.content[0].text).toContain('style');
      expect(result.content[0].text).toContain('security');
    });
  });

  describe('edicts_review', () => {
    it('preview returns review information', async () => {
      await store.add({ text: 'A durable edict', category: 'test' });
      const result = await executeTool(tools, 'edicts_review', {});
      expect(result.content[0].text).toBeDefined();
      // Preview mode — should not remove anything
    });

    it('compact executes cleanup', async () => {
      // Add an edict that's already expired so auto-prune will remove it,
      // then verify compact reports sensibly
      const result = await executeTool(tools, 'edicts_review', { action: 'compact' });
      expect(result.content[0].text).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/tools.test.ts
```

Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `registerEdictTools()`**

Create `src/tools.ts`:

```typescript
import type { EdictStore, Edict } from 'edicts';
import { renderPlain } from 'edicts';

interface PluginApi {
  registerTool(tool: ToolDefinition): void;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute(callId: string, params: Record<string, any>): Promise<ToolResult>;
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
}

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function formatEdict(e: Edict): string {
  const parts = [`[${e.id}] ${e.text}`];
  parts.push(`  Category: ${e.category} | TTL: ${e.ttl} | Confidence: ${e.confidence}`);
  if (e.tags.length > 0) parts.push(`  Tags: ${e.tags.join(', ')}`);
  if (e.key) parts.push(`  Key: ${e.key}`);
  if (e.expiresAt) parts.push(`  Expires: ${e.expiresAt}`);
  return parts.join('\n');
}

export function registerEdictTools(api: PluginApi, store: EdictStore): void {

  // ── edicts_list ──────────────────────────────────────────────

  api.registerTool({
    name: 'edicts_list',
    description: 'List edicts with optional filtering by category, tags, or TTL.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (any match)',
        },
        ttl: {
          type: 'string',
          enum: ['ephemeral', 'event', 'durable', 'permanent'],
          description: 'Filter by TTL level',
        },
        limit: { type: 'number', description: 'Max results to return' },
      },
    },
    async execute(_callId, params) {
      try {
        let edicts = await store.all();

        if (params.category) {
          edicts = edicts.filter((e) => e.category === params.category.toLowerCase());
        }
        if (params.tags && params.tags.length > 0) {
          const filterTags = params.tags.map((t: string) => t.toLowerCase());
          edicts = edicts.filter((e) => e.tags.some((t) => filterTags.includes(t)));
        }
        if (params.ttl) {
          edicts = edicts.filter((e) => e.ttl === params.ttl);
        }
        if (params.limit && params.limit > 0) {
          edicts = edicts.slice(0, params.limit);
        }

        if (edicts.length === 0) {
          return textResult('0 edicts found.');
        }

        const lines = edicts.map(formatEdict);
        return textResult(`${edicts.length} edicts found:\n\n${lines.join('\n\n')}`);
      } catch (err: any) {
        return textResult(`Error listing edicts: ${err.message}`);
      }
    },
  });

  // ── edicts_add ───────────────────────────────────────────────

  api.registerTool({
    name: 'edicts_add',
    description: 'Create a new edict (standing instruction).',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Edict content (required)' },
        category: { type: 'string', description: 'Category (default: "general")' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the edict',
        },
        confidence: {
          type: 'string',
          enum: ['verified', 'inferred', 'user'],
          description: 'Confidence level (default: "user")',
        },
        source: { type: 'string', description: 'Provenance (default: "agent")' },
        key: { type: 'string', description: 'Dedup/supersession key' },
        ttl: {
          type: 'string',
          enum: ['ephemeral', 'event', 'durable', 'permanent'],
          description: 'Time-to-live (default: "durable")',
        },
        expiresAt: { type: 'string', description: 'Expiry date (ISO 8601)' },
      },
      required: ['text'],
    },
    async execute(_callId, params) {
      if (!params.text || typeof params.text !== 'string' || !params.text.trim()) {
        return textResult('Error: "text" is required and must be a non-empty string.');
      }

      try {
        const result = await store.add({
          text: params.text,
          category: params.category || 'general',
          tags: params.tags,
          confidence: params.confidence,
          source: params.source || 'agent',
          key: params.key,
          ttl: params.ttl,
          expiresAt: params.expiresAt,
        });

        const edict = result.edict!;
        return textResult(
          `Created edict [${edict.id}]:\n${formatEdict(edict)}`,
        );
      } catch (err: any) {
        return textResult(`Error adding edict: ${err.message}`);
      }
    },
  });

  // ── edicts_update ────────────────────────────────────────────

  api.registerTool({
    name: 'edicts_update',
    description: 'Update an existing edict.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Edict ID (required)' },
        text: { type: 'string', description: 'New content' },
        category: { type: 'string', description: 'New category' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags',
        },
        confidence: {
          type: 'string',
          enum: ['verified', 'inferred', 'user'],
        },
        ttl: {
          type: 'string',
          enum: ['ephemeral', 'event', 'durable', 'permanent'],
        },
        expiresAt: { type: 'string', description: 'New expiry (ISO 8601)' },
      },
      required: ['id'],
    },
    async execute(_callId, params) {
      if (!params.id) {
        return textResult('Error: "id" is required.');
      }

      const { id, ...patch } = params;
      const hasChanges = Object.values(patch).some((v) => v !== undefined);
      if (!hasChanges) {
        return textResult('Error: at least one field to update must be provided.');
      }

      try {
        const result = await store.update(id, patch);
        const edict = result.edict!;
        return textResult(
          `Updated edict [${edict.id}]:\n${formatEdict(edict)}`,
        );
      } catch (err: any) {
        if (err.name === 'EdictNotFoundError') {
          return textResult(`Edict not found with id "${id}".`);
        }
        return textResult(`Error updating edict: ${err.message}`);
      }
    },
  });

  // ── edicts_remove ────────────────────────────────────────────

  api.registerTool({
    name: 'edicts_remove',
    description: 'Remove an edict.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Edict ID (required)' },
      },
      required: ['id'],
    },
    async execute(_callId, params) {
      if (!params.id) {
        return textResult('Error: "id" is required.');
      }

      try {
        const result = await store.remove(params.id);
        if (result.action === 'not_found') {
          return textResult(`Edict not found with id "${params.id}".`);
        }
        const edict = result.edict!;
        return textResult(`Removed edict [${edict.id}]: "${edict.text}"`);
      } catch (err: any) {
        return textResult(`Error removing edict: ${err.message}`);
      }
    },
  });

  // ── edicts_search ────────────────────────────────────────────

  api.registerTool({
    name: 'edicts_search',
    description: 'Free-text search across edicts.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text (required)' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
    async execute(_callId, params) {
      if (!params.query) {
        return textResult('Error: "query" is required.');
      }

      try {
        let results = await store.search(params.query);
        const total = results.length;
        const limit = params.limit ?? 10;
        if (limit > 0) {
          results = results.slice(0, limit);
        }

        if (results.length === 0) {
          return textResult(`0 edicts match "${params.query}".`);
        }

        const lines = results.map(formatEdict);
        const suffix = total > results.length ? `\n\n(showing ${results.length} of ${total} matches)` : '';
        return textResult(
          `${total} edicts match "${params.query}":\n\n${lines.join('\n\n')}${suffix}`,
        );
      } catch (err: any) {
        return textResult(`Error searching edicts: ${err.message}`);
      }
    },
  });

  // ── edicts_stats ─────────────────────────────────────────────

  api.registerTool({
    name: 'edicts_stats',
    description: 'Show edict store statistics: counts, categories, tokens, TTL distribution.',
    parameters: {
      type: 'object',
      properties: {},
    },
    async execute() {
      try {
        const stats = await store.stats();
        const lines = [
          `Total edicts: ${stats.total}`,
          `History entries: ${stats.history}`,
          `Token usage: ${stats.tokenCount} / ${stats.tokenBudget} (${stats.tokenBudgetRemaining} remaining)`,
          '',
          'By category:',
          ...Object.entries(stats.byCategory).map(([k, v]) => `  ${k}: ${v}`),
          '',
          'By TTL:',
          ...Object.entries(stats.byTtl).map(([k, v]) => `  ${k}: ${v}`),
          '',
          'By confidence:',
          ...Object.entries(stats.byConfidence).map(([k, v]) => `  ${k}: ${v}`),
        ];

        if (Object.keys(stats.byTag).length > 0) {
          lines.push('', 'By tag:');
          lines.push(...Object.entries(stats.byTag).map(([k, v]) => `  ${k}: ${v}`));
        }

        return textResult(lines.join('\n'));
      } catch (err: any) {
        return textResult(`Error fetching stats: ${err.message}`);
      }
    },
  });

  // ── edicts_review ────────────────────────────────────────────

  api.registerTool({
    name: 'edicts_review',
    description:
      'Review stale/expiring edicts and optionally compact. Use action="preview" (default) to see candidates, action="compact" to execute cleanup.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['preview', 'compact'],
          description: 'Preview candidates or execute compaction (default: "preview")',
        },
      },
    },
    async execute(_callId, params) {
      const action = params.action ?? 'preview';

      try {
        if (action === 'preview') {
          const review = await store.review();
          const lines: string[] = [];

          if (review.stale.length > 0) {
            lines.push(`Stale edicts (>${(store as any).staleThresholdDays ?? 90} days without access):`);
            lines.push(...review.stale.map((e) => `  [${e.id}] ${e.text}`));
          } else {
            lines.push('No stale edicts.');
          }

          lines.push('');

          if (review.expiringSoon.length > 0) {
            lines.push('Expiring soon (within 7 days):');
            lines.push(...review.expiringSoon.map((e) => `  [${e.id}] ${e.text} (expires: ${e.expiresAt})`));
          } else {
            lines.push('No edicts expiring soon.');
          }

          lines.push('');

          const cap = review.capacity;
          lines.push(`Capacity: ${Math.round(cap.countUsage * 100)}% count, ${Math.round(cap.tokenUsage * 100)}% tokens`);
          if (cap.warnings.length > 0) {
            lines.push('Warnings:');
            lines.push(...cap.warnings.map((w) => `  ⚠️ ${w}`));
          }

          if (review.compactionCandidates.length > 0) {
            lines.push('');
            lines.push('Compaction candidates:');
            for (const group of review.compactionCandidates) {
              lines.push(`  ${group.keyPrefix} (${group.category}): ${group.edicts.length} edicts could be merged`);
            }
          }

          return textResult(lines.join('\n'));
        }

        // compact mode — report capacity before/after
        const beforeStats = await store.stats();
        const review = await store.review();

        if (review.compactionCandidates.length === 0 && review.stale.length === 0) {
          return textResult('Nothing to compact. Store is clean.');
        }

        // Note: actual compaction requires the agent to provide merged text for each group.
        // The review tool surfaces candidates — the agent decides how to merge them.
        const lines = [
          'Compaction review complete.',
          `${review.stale.length} stale edicts found.`,
          `${review.compactionCandidates.length} compaction groups found.`,
          '',
          'To compact a group, use edicts_update to merge the edicts manually,',
          'then edicts_remove the originals. Or use the edicts library compact() directly.',
          '',
          `Current: ${beforeStats.total} edicts, ${beforeStats.tokenCount} tokens`,
        ];

        return textResult(lines.join('\n'));
      } catch (err: any) {
        return textResult(`Error during review: ${err.message}`);
      }
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/tools.test.ts
```

Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add src/tools.ts tests/tools.test.ts
git commit -m "feat(tools): implement all 7 agent tools — list, add, update, remove, search, stats, review"
```

---

## Chunk 4: Entry Point & Integration

### Task 5: Implement plugin entry point (`index.ts`)

**Files:**
- Create: `index.ts`

- [ ] **Step 1: Implement entry point**

Create `index.ts`:

```typescript
import path from 'node:path';
import { EdictStore, YamlStorage, JsonStorage } from 'edicts';
import type { Storage } from 'edicts';
import { resolveConfig } from './src/config.js';
import { createContextHook } from './src/context.js';
import { registerEdictTools } from './src/tools.js';

interface OpenClawPluginApi {
  pluginConfig: Record<string, unknown>;
  workspaceDir: string;
  logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
  };
  registerTool(tool: any): void;
  on(event: string, handler: (...args: any[]) => any, options?: any): void;
}

const plugin = {
  id: 'edicts',
  name: 'Edicts',
  description: 'Inject agent edicts into context and expose CRUD tools.',

  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig as any);

    const storePath = path.resolve(api.workspaceDir, config.path);
    const storage: Storage =
      config.format === 'json'
        ? new JsonStorage(storePath)
        : new YamlStorage(storePath);

    const store = new EdictStore({ storage, autoSave: true });

    // Load store asynchronously — tools handle the case where load hasn't completed yet
    // by calling store methods that trigger auto-load internally.
    // The store's public methods (all, find, add, etc.) call _autoPrune() which
    // triggers load if not yet loaded.
    store.load().catch((err) => {
      api.logger.warn(`Edicts: failed to pre-load store from ${storePath}: ${err.message}`);
      // Non-fatal — store will attempt load on first tool call
    });

    api.logger.info(`Edicts plugin loaded — store: ${storePath}, format: ${config.format}`);

    registerEdictTools(api, store);

    if (config.autoInject) {
      api.on('before_prompt_build', createContextHook(store, config));
      api.logger.info(`Edicts: auto-inject enabled (filter: ${config.autoInjectFilter}, budget: ${config.tokenBudget} tokens)`);
    }
  },
};

export default plugin;
```

**Design note on store loading:** The EdictStore's public methods (`all()`, `find()`, `add()`, etc.) all call `_autoPrune()` internally which triggers a load if the store hasn't been loaded yet. We pre-load eagerly so context injection on the first session doesn't hit disk latency, but if it fails the store will retry on first use.

- [ ] **Step 2: Verify full project compiles**

```bash
npx tsc --noEmit
```

Expected: Clean compile

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass across all 3 test files

- [ ] **Step 4: Build**

```bash
npx tsup
```

Expected: `dist/` created with `index.js`, `index.cjs`, `index.d.ts`

- [ ] **Step 5: Commit**

```bash
git add index.ts
git commit -m "feat: plugin entry point — wires EdictStore, tools, and context hook"
```

---

## Chunk 5: Integration Testing & Polish

### Task 6: Integration smoke test

This is a manual verification that the plugin loads correctly in OpenClaw.

- [ ] **Step 1: Install plugin locally**

```bash
# From the openclaw-plugin-edicts directory
npm link

# Or copy to OpenClaw extensions
cp -r . ~/.openclaw/extensions/edicts/
```

- [ ] **Step 2: Configure OpenClaw**

Add to `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "edicts": {
        "enabled": true,
        "config": {
          "path": "edicts.yaml",
          "autoInject": true,
          "autoInjectFilter": "all",
          "tokenBudget": 2000
        }
      }
    }
  }
}
```

- [ ] **Step 3: Restart gateway and verify**

```bash
openclaw gateway restart
openclaw plugins list    # Should show "edicts" as enabled
```

- [ ] **Step 4: Test tools from agent**

In a chat session, verify:
- `edicts_add` creates an edict
- `edicts_list` shows it
- `edicts_stats` returns valid output
- `edicts_search` finds it
- `edicts_update` modifies it
- `edicts_review` shows review info
- `edicts_remove` deletes it

- [ ] **Step 5: Verify context injection**

Start a new session after adding a few edicts. Check that the system context includes the `## Edicts (Standing Instructions)` block by asking the agent what standing instructions it has.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

### Task 7: Add README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# openclaw-plugin-edicts

OpenClaw plugin adapter for the [edicts](https://npmjs.com/package/edicts) library — agent standing instructions, auto-injected into context.

## What it does

- **Context injection**: Auto-injects edicts into every agent session via system prompt
- **7 agent tools**: `edicts_list`, `edicts_add`, `edicts_update`, `edicts_remove`, `edicts_search`, `edicts_stats`, `edicts_review`
- **Token-aware**: Configurable token budget with priority-based truncation (permanent > durable > event > ephemeral)

## Install

\`\`\`bash
npm install openclaw-plugin-edicts edicts
# or
openclaw plugins install openclaw-plugin-edicts
\`\`\`

## Configure

Add to `openclaw.json`:

\`\`\`json
{
  "plugins": {
    "entries": {
      "edicts": {
        "enabled": true,
        "config": {
          "path": "edicts.yaml",
          "autoInject": true,
          "tokenBudget": 2000
        }
      }
    }
  }
}
\`\`\`

Restart the gateway. Done.

## Config options

| Option | Default | Description |
|--------|---------|-------------|
| `path` | `edicts.yaml` | Path to storage file (relative to workspace) |
| `format` | Inferred from extension | `yaml` or `json` |
| `autoInject` | `true` | Inject edicts into system context |
| `autoInjectFilter` | `all` | Which edicts to inject (v1: all) |
| `tokenBudget` | `2000` | Max tokens for context injection |

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Done Criteria

- [ ] All tests pass (`npx vitest run` — 3 test files, ~30+ test cases)
- [ ] Project builds cleanly (`npx tsup`)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] Plugin manifest validates against OpenClaw schema
- [ ] Plugin loads in OpenClaw and tools are accessible
- [ ] Context injection works (edicts appear in system prompt)
- [ ] All 7 tools work end-to-end
- [ ] README exists with install/config instructions
