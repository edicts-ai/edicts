# Edicts — OpenClaw Plugin Adapter Design

> Task #344 | Designed 2026-03-20

## Goal

A standalone npm package (`openclaw-plugin-edicts`) that wires the `edicts` library into the OpenClaw agent runtime. Thin adapter — all domain logic lives in the core library; the plugin handles registration, context injection, and config resolution.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repository | Standalone (separate from `edicts` core) | Clean separation; edicts is framework-agnostic |
| Plugin structure | Modular (`index.ts` + `src/{tools,context,config}.ts`) | 7 tools + hook + config too much for single file; tool-per-file is overkill |
| Tool availability | Required (always on when plugin enabled) | Edicts are a core agent capability, not an optional side effect |
| Context injection | `appendSystemContext` via `before_prompt_build` | Augments system prompt without overriding SOUL.md or other prepended context |
| Filtering | v1: all edicts, all sessions | YAGNI — seam ready for per-session tag matching in v2 |
| Token budget | Configurable, default 2000 | Handled by core library's `renderPlain()` with priority ordering |
| Store lifecycle | Single instance shared across tools and hook | Optimistic concurrency in core library handles concurrent sessions |
| Error handling | Catch known library errors, return friendly messages | Agent should get actionable text, not stack traces |
| Test approach | Real EdictStore with memory storage, mocked plugin API | Test the wiring, not the domain logic (101+ tests in core) |

## Package Structure

```
openclaw-plugin-edicts/
├── openclaw.plugin.json        # Plugin manifest (required by OpenClaw)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── index.ts                    # Entry point — plugin object with register(api)
├── src/
│   ├── config.ts               # Config resolution & defaults
│   ├── context.ts              # before_prompt_build hook (context injection)
│   └── tools.ts                # All 7 tool definitions
└── tests/
    ├── config.test.ts
    ├── context.test.ts
    └── tools.test.ts
```

**Dependencies:**
- `edicts` — peer dependency (user installs the core library)
- `openclaw` — peer dependency (plugin SDK types only)
- No other runtime dependencies

**Build:** `tsup` → ESM + CJS dual output (matches core library pattern)

## Plugin Manifest

**`openclaw.plugin.json`:**

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

## Config

**User config in `openclaw.json`:**

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

**Defaults (resolved in `src/config.ts`):**

| Field | Default | Rationale |
|-------|---------|-----------|
| `path` | `"edicts.yaml"` | Relative to workspace root |
| `format` | Inferred from extension, fallback `"yaml"` | YAML is human-editable |
| `autoInject` | `true` | Primary purpose of the plugin |
| `autoInjectFilter` | `"all"` | Only option in v1 |
| `tokenBudget` | `2000` | ~500 words — reasonable without hogging context window |

**`autoInjectFilter`** is a string enum (not boolean) so v2 can add `"category:<name>"` and `"tags:<tag1>,<tag2>"` values without breaking existing configs.

### Config Resolution (`src/config.ts`)

```ts
interface ResolvedConfig {
  path: string;
  format: "yaml" | "json";
  autoInject: boolean;
  autoInjectFilter: "all";
  tokenBudget: number;
}

function resolveConfig(raw: Record<string, unknown>): ResolvedConfig;
```

- Merges user-provided values over defaults
- Infers `format` from `path` extension when not explicitly set (`.json` → json, anything else → yaml)

## Plugin Entry Point (`index.ts`)

```ts
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { EdictStore, YamlStorage, JsonStorage } from "edicts";
import { resolveConfig } from "./src/config.js";
import { createContextHook } from "./src/context.js";
import { registerEdictTools } from "./src/tools.js";

const plugin = {
  id: "edicts",
  name: "Edicts",
  description: "Inject agent edicts into context and expose CRUD tools.",

  register(api: OpenClawPluginApi) {
    const config = resolveConfig(api.pluginConfig);

    const storePath = path.resolve(api.workspaceDir, config.path);
    const storage = config.format === "json"
      ? new JsonStorage(storePath)
      : new YamlStorage(storePath);
    const store = new EdictStore({ storage });

    registerEdictTools(api, store);

    if (config.autoInject) {
      api.on("before_prompt_build", createContextHook(store, config));
    }
  },
};

export default plugin;
```

**Lifecycle:**
1. OpenClaw discovers plugin, validates config against manifest schema (no code executed)
2. On gateway start, calls `register(api)`
3. `resolveConfig()` merges user config with defaults
4. `EdictStore` instantiated once with file-backed storage
5. All 7 tools registered (required — always available)
6. `before_prompt_build` hook registered if `autoInject` is true
7. Store persists for plugin lifetime; reads from disk per operation (no stale cache)

**Error on init:** If the storage file doesn't exist, `EdictStore` handles gracefully (empty store). First `edicts_add` creates the file. If the path is truly broken (permissions, invalid dir), the error surfaces on first tool call — not on plugin load.

## Tools (`src/tools.ts`)

All tools registered as **required** (always available when plugin is enabled).

**Naming convention:** `edicts_<action>` (underscores — OpenClaw tool convention).

**Return format:** Every tool returns `{ content: [{ type: "text", text }] }` per OpenClaw convention. Text output is human-readable, not raw JSON — the agent reasons about it naturally.

**Error handling:** Each tool wraps its store call in try/catch. Known errors from the edicts library (`EdictNotFoundError`, `EdictValidationError`, `ConcurrencyError`) produce friendly messages. Unknown errors surface with the raw message.

### `edicts_list`

```
Description: List edicts with optional filtering.

Parameters:
  category?: string      — filter by category
  tags?: string[]        — filter by tags (any match)
  ttl?: string           — filter by TTL level (ephemeral|event|durable|permanent)
  limit?: number         — max results (default: all)

Implementation: store.find(predicate) → renderPlain(results)
Returns: Rendered edict list + count. Empty message if no matches.
```

### `edicts_add`

```
Description: Create a new edict (standing instruction).

Parameters:
  text: string           — edict content (REQUIRED)
  category?: string      — defaults to "general"
  tags?: string[]        — defaults to []
  confidence?: string    — "verified" | "inferred" | "user" (default: "user")
  source?: string        — provenance (default: "agent")
  key?: string           — dedup/supersession key
  ttl?: string           — "ephemeral" | "event" | "durable" | "permanent" (default: "durable")
  expiresAt?: string     — ISO 8601, for ephemeral/event TTLs

Implementation: store.add(params)
Returns: Created edict summary (id, text, category) + confirmation.
```

### `edicts_update`

```
Description: Update an existing edict.

Parameters:
  id: string             — edict ID (REQUIRED)
  text?: string          — new content
  category?: string
  tags?: string[]
  confidence?: string
  ttl?: string
  expiresAt?: string

Implementation: store.update(id, changes)
Validation: At least one field besides id must be provided.
Returns: Updated edict summary + what changed.
Errors: EdictNotFoundError → "No edict found with id '<id>'"
```

### `edicts_remove`

```
Description: Remove an edict.

Parameters:
  id: string             — edict ID (REQUIRED)

Implementation: store.remove(id)
Returns: Confirmation with removed edict text.
Errors: EdictNotFoundError → "No edict found with id '<id>'"
```

### `edicts_search`

```
Description: Free-text search across edicts.

Parameters:
  query: string          — search text (REQUIRED)
  limit?: number         — max results (default: 10)

Implementation: store.search(query, { limit })
Returns: Matching edicts ranked by relevance, with scores.
```

### `edicts_stats`

```
Description: Show edict store statistics.

Parameters: (none)

Implementation: store.stats()
Returns: Total count, by-category breakdown, token usage, TTL distribution.
```

### `edicts_review`

```
Description: Review and optionally clean up stale/expired edicts.

Parameters:
  action?: "preview" | "compact"   — default "preview"

Implementation:
  "preview" → store.review() — shows stale/expired candidates
  "compact" → store.compact() — executes cleanup, returns what was removed

Returns:
  preview: List of candidates for removal with reasons.
  compact: Summary of what was removed + before/after counts.
```

## Context Injection (`src/context.ts`)

```ts
import { renderPlain } from "edicts";
import type { EdictStore } from "edicts";
import type { ResolvedConfig } from "./config.js";

export function createContextHook(store: EdictStore, config: ResolvedConfig) {
  return async () => {
    const edicts = store.find(() => true); // v1: all edicts

    if (edicts.length === 0) {
      return {};
    }

    const rendered = renderPlain(edicts, {
      tokenBudget: config.tokenBudget,
      priorityOrder: ["permanent", "durable", "event", "ephemeral"],
    });

    return {
      appendSystemContext: wrapEdicts(rendered),
    };
  };
}

function wrapEdicts(rendered: string): string {
  return [
    "## Edicts (Standing Instructions)",
    "The following are your standing instructions. Follow them unless explicitly overridden.",
    "",
    rendered,
  ].join("\n");
}
```

**Key decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hook field | `appendSystemContext` | Augments system prompt at the end — doesn't interfere with SOUL.md or other prepended context |
| Empty store | Return `{}` | Zero overhead when no edicts exist |
| Renderer | `renderPlain()` from edicts lib | Already built, token-aware, handles truncation |
| Priority order | permanent → durable → event → ephemeral | If budget forces truncation, permanent edicts survive; ephemeral cut first |
| Wrapper text | Short header + behavioral instruction | Agent must know these are standing instructions, not conversation history |

**Token budget flow:**
1. Config sets `tokenBudget` (default 2000)
2. `renderPlain()` renders edicts in priority order, counting tokens
3. When budget exhausted, remaining edicts truncated with `[N more edicts truncated]` note
4. All handled by core library — plugin just passes the budget through

**Future v2 seam:** Replace `store.find(() => true)` with a filtered predicate. When OpenClaw exposes session metadata in the `before_prompt_build` event, the hook can read task tags and filter edicts per session.

## Testing Strategy

**Framework:** Vitest (matches core library)

### `tests/config.test.ts`
- Merges user config with defaults correctly
- Infers format from file extension (`.yaml` → yaml, `.json` → json)
- Falls back to yaml when no extension hint
- Handles missing/partial/empty config gracefully
- All defaults applied when config is `{}`

### `tests/context.test.ts`
- Returns `{}` when store is empty (no injection)
- Renders all edicts wrapped in header when store has data
- Respects `tokenBudget` — truncates when budget exceeded
- Priority ordering: permanent edicts survive truncation, ephemeral cut first
- Output starts with `## Edicts (Standing Instructions)` header

### `tests/tools.test.ts`
- **edicts_list:** returns all edicts; respects category/tag/ttl filters; handles empty store
- **edicts_add:** creates edict with defaults; creates with all fields specified; validates required `text` param
- **edicts_update:** updates specified fields; errors on unknown ID; requires at least one change field
- **edicts_remove:** removes by ID; errors on unknown ID; returns removed edict text
- **edicts_search:** returns ranked results; handles no matches
- **edicts_stats:** returns correct shape (counts, categories, tokens, TTL distribution)
- **edicts_review:** preview mode shows candidates without mutating; compact mode executes and returns summary

**Test approach:**
- Real `EdictStore` with in-memory storage adapter (no filesystem)
- Plugin API mocked: `api.registerTool()`, `api.on()`, `api.pluginConfig`, `api.workspaceDir`, `api.logger`
- Test the adapter wiring, not domain logic (covered by 101+ tests in core library)

**Not tested here:**
- EdictStore CRUD correctness (core library's job)
- OpenClaw plugin loading/discovery (OpenClaw's job)
- Token counting accuracy (core library concern)

## Installation & Usage

```bash
# Install
npm install openclaw-plugin-edicts edicts

# Or via OpenClaw CLI
openclaw plugins install openclaw-plugin-edicts
```

**Add to `openclaw.json`:**
```json
{
  "plugins": {
    "entries": {
      "edicts": {
        "enabled": true,
        "config": {
          "path": "edicts.yaml"
        }
      }
    }
  }
}
```

Restart the gateway. Edicts are injected into every session and 7 tools are available to the agent.

## Future (v2 — not in scope)

- **Per-session filtering:** Inject edicts by category/tags based on session type or task metadata
- **Convention-based tag matching:** Parse `[edicts:tag1,tag2]` from cron/sub-agent task prompts
- **Config profiles:** Named filter sets (`"edictProfile": "security-ops"`) for different agent configurations
- **Webhook for external writes:** HTTP endpoint for other systems to push edicts
