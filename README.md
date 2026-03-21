# Edicts

Ground truth for AI agents.

Edicts is a small TypeScript library for storing cheap, verified facts that your agent should treat as non-negotiable. Instead of stuffing long documents into every prompt or building a full retrieval stack for a handful of critical facts, you keep a compact set of assertions in YAML or JSON, render them into prompt context, and give agents optional tool access for runtime reads and updates.

Docs: https://edicts.ai  
Blog: https://edicts.ai/docs/blog/why-we-built-edicts  
License: MIT

## The problem

Agents are surprisingly good at sounding certain about things they should never improvise: launch dates, product limitations, compliance constraints, internal naming, migration status, embargoes, and “definitely not” statements. Those facts are usually tiny, high-value, and expensive to get wrong. Edicts gives you a lightweight ground-truth layer for exactly that class of information.

## 30-second quick start

Install the package:

```bash
npm install edicts
```

Create an edicts file:

```yaml
version: 1
config:
  maxEdicts: 200
  tokenBudget: 4000
  categories: [product, compliance, operations]
edicts:
  - id: launch_date
    text: "Product v2.0 launches April 15, NOT before."
    category: product
    tags: [launch, public]
    confidence: verified
    source: roadmap-review
    key: launch_date
    ttl: event
    expiresAt: "2026-04-16T00:00:00.000Z"
    created: "2026-03-21T00:00:00.000Z"
    updated: "2026-03-21T00:00:00.000Z"
history: []
```

List it with the CLI:

```bash
npx edicts list --path ./edicts.yaml
```

Inject it into your system prompt:

```ts
import { EdictStore } from 'edicts';

const store = new EdictStore({ path: './edicts.yaml' });
await store.load();

const systemPrompt = `You are a helpful assistant.

${await store.render('markdown')}

Treat these edicts as ground truth. Never contradict them.`;
```

That is the whole idea: small verified facts, cheap enough to include all the time.

## Why Edicts?

- **Built for high-value facts, not conversational memory.** Edicts is for “this is true” and “this is not true,” not giant transcript recall.
- **Tiny context footprint.** A few critical edicts can cost tens of tokens, not thousands.
- **Time-aware by default.** Ephemeral and event-based facts expire automatically.
- **Framework-agnostic.** Use it with any LLM stack that can prepend text or expose tools.
- **Simple storage.** YAML or JSON on disk, atomic writes, optimistic concurrency, minimal dependencies.

If you want the backstory, read [Why We Built Edicts](./docs/blog/why-we-built-edicts.md).

## Key features

- YAML and JSON storage
- Automatic expiry pruning on load/render
- Sequential IDs (`e_001`, `e_002`) or stable user-provided keys
- Key-based supersession for facts that change over time
- Token budget enforcement with rollback on overflow
- Category allowlists and category soft limits
- Built-in plain, markdown, and JSON renderers
- Optional custom tokenizer and custom renderer hooks
- CLI for common operations
- OpenClaw plugin bundled in the package, without making the core library framework-dependent

## Installation

```bash
npm install edicts
```

Requirements:

- Node.js >= 20
- TypeScript recommended, but not required

## Core API

```ts
import { EdictStore } from 'edicts';

const store = new EdictStore({
  path: './edicts.yaml',
  tokenBudget: 4000,
  categories: ['product', 'compliance', 'operations'],
});

await store.load();

await store.add({
  text: 'The public launch date is April 15, NOT earlier.',
  category: 'product',
  confidence: 'verified',
  ttl: 'event',
  expiresAt: '2026-04-16T00:00:00.000Z',
});

const promptContext = await store.render('markdown');
const stats = await store.stats();
```

The primary interface is the `EdictStore` class. See the full API reference at https://edicts.ai/docs/reference/api.

## Configuration overview

The constructor accepts `EdictStoreOptions`:

```ts
const store = new EdictStore({
  path: './edicts.yaml',               // default: ./edicts.yaml
  format: 'yaml',                      // yaml | json
  maxEdicts: 200,                      // active edict cap
  tokenBudget: 4000,                   // total token cap across active edicts
  categories: ['product', 'ops'],      // optional allowlist
  staleThresholdDays: 90,              // durable edicts become stale after this many days
  categoryLimits: { product: 30 },     // optional soft limits by category
  defaultCategoryLimit: 50,            // fallback soft limit
  defaultEphemeralTtlSeconds: 86400,   // default for ephemeral edicts with no explicit expiry
  autoSave: true,                      // save after mutations
  tokenizer: (text) => Math.ceil(text.length / 4),
  renderer: undefined,                 // custom renderer overrides built-ins
});
```

Useful defaults:

- `path`: `./edicts.yaml`
- `format`: inferred from the file extension when omitted
- `maxEdicts`: `200`
- `tokenBudget`: `4000`
- `staleThresholdDays`: `90`
- `defaultEphemeralTtlSeconds`: `86400`
- `autoSave`: `true`

## YAML schema example

A realistic store usually mixes long-lived facts with short-lived operational context:

```yaml
version: 1
config:
  maxEdicts: 200
  tokenBudget: 4000
  categories:
    - product
    - compliance
    - operations
  staleThresholdDays: 90
edicts:
  - id: current_release
    key: current_release
    text: "Current production release is v2.4.1."
    category: product
    tags: [release]
    confidence: verified
    source: release-bot
    ttl: durable
    created: "2026-03-21T14:00:00.000Z"
    updated: "2026-03-21T14:00:00.000Z"

  - id: nda_constraint
    key: nda_constraint
    text: "Do not name unannounced design partners publicly."
    category: compliance
    tags: [legal, external]
    confidence: verified
    source: legal-review
    ttl: permanent
    created: "2026-03-21T14:05:00.000Z"
    updated: "2026-03-21T14:05:00.000Z"

  - id: migration_window
    key: migration_window
    text: "User-profile writes are disabled during the migration window."
    category: operations
    tags: [migration, database]
    confidence: verified
    source: incident-channel
    ttl: ephemeral
    expiresAt: "2026-03-22T06:00:00.000Z"
    created: "2026-03-21T22:00:00.000Z"
    updated: "2026-03-21T22:00:00.000Z"
history: []
```

Schema reference: https://edicts.ai/docs/reference/yaml-schema

## Common operations

### Add an edict

```ts
await store.add({
  text: 'The enterprise plan does NOT include white-label support.',
  category: 'product',
  confidence: 'verified',
  ttl: 'durable',
  source: 'pricing-doc',
  tags: ['plan', 'limits'],
});
```

### Supersede a changing fact using `key`

```ts
await store.add({
  key: 'current_release',
  text: 'Current production release is v2.4.2.',
  category: 'product',
  confidence: 'verified',
  ttl: 'durable',
});
```

If an active edict already has the same `key`, Edicts archives the old one into history and keeps the new one active.

### Render for prompts

```ts
const plain = await store.render('plain');
const markdown = await store.render('markdown');
const json = await store.render('json');
```

### Review store health

```ts
const review = await store.review();

console.log(review.stale);
console.log(review.expiringSoon);
console.log(review.compactionCandidates);
```

### Check stats

```ts
const stats = await store.stats();
console.log(stats.tokenCount, stats.tokenBudgetRemaining);
```

## CLI

The CLI is a convenience layer over the API. It is handy for bootstrapping, inspection, and lightweight operational workflows.

```bash
edicts init --path ./edicts.yaml
edicts add --path ./edicts.yaml --text "Launch date is April 15" --category product --confidence verified
edicts list --path ./edicts.yaml
edicts stats --path ./edicts.yaml
```

Full CLI reference: https://edicts.ai/docs/reference/cli

## Framework integration

### Any framework

Edicts does not depend on LangChain, OpenAI SDKs, Anthropic SDKs, OpenClaw, or any other orchestration layer. The generic pattern is:

1. `await store.load()`
2. `await store.render()` and prepend it to your system prompt
3. Optionally expose `store.add`, `store.update`, `store.get`, `store.find`, or `store.search` as tools

See the generic integration guide: https://edicts.ai/docs/integrations/generic

### OpenClaw

This package also ships a first-party OpenClaw plugin adapter for automatic prompt injection and runtime tools.

```json
{
  "plugins": {
    "entries": {
      "openclaw-plugin-edicts": {
        "enabled": true,
        "config": {
          "path": "./edicts.yaml",
          "renderFormat": "markdown",
          "includeSystemContext": true,
          "systemContextHeading": "Edicts",
          "contextMaxEdicts": 20,
          "tools": {
            "optional": true
          }
        }
      }
    }
  }
}
```

Full OpenClaw guide: https://edicts.ai/docs/integrations/openclaw

## Documentation

- Installation: https://edicts.ai/docs/getting-started/installation
- Quick Start: https://edicts.ai/docs/getting-started/quick-start
- Best Practices: https://edicts.ai/docs/guides/best-practices
- Memory Hierarchy: https://edicts.ai/docs/guides/memory-hierarchy
- Configuration reference: https://edicts.ai/docs/reference/configuration
- YAML schema: https://edicts.ai/docs/reference/yaml-schema
- API reference: https://edicts.ai/docs/reference/api
- CLI reference: https://edicts.ai/docs/reference/cli
- Generic integration guide: https://edicts.ai/docs/integrations/generic
- OpenClaw integration: https://edicts.ai/docs/integrations/openclaw

## Programmatic exports

```ts
import {
  EdictStore,
  openclawPluginEdicts,
  createEdictsTools,
  buildBeforePromptBuildResult,
} from 'edicts';
```

The core library stays framework-agnostic. The OpenClaw adapter is included as an additional export, not as a core runtime dependency for the store itself.

## Contributing

PRs are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before sending changes.

## License

MIT
