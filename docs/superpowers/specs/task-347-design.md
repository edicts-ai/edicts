# Task 347 — Comprehensive Documentation

## Status: APPROVED (design phase)

## Overview

Write comprehensive documentation for Edicts as a **standalone product**. The edicts.ai docs site already has substantial content (API reference, configuration, YAML schema, OpenClaw integration, guides). This task fills the gaps and rewrites the README to sell the product, not just the OpenClaw plugin.

## Decisions (from brainstorming)

| # | Question | Decision |
|---|----------|----------|
| 1 | Audience | C — standalone product first, OpenClaw as one integration |
| 2 | Blog post | B — polished external publication, saved to `docs/blog/why-we-built-edicts.md` |
| 3 | API reference | A — hand-written curated markdown (already exists on edicts.ai) |
| 4 | Framework guides | A — OpenClaw guide (exists) + generic integration guide; no vaporware |
| 5 | CLI reference | B — document what exists, frame as convenience tool |
| 6 | Architecture | 4 — medium-weight README linking to edicts.ai for deep docs |

## Deliverables

### 1. README.md rewrite

**File:** `README.md` (edicts repo root)
**Replaces:** Current OpenClaw-centric README

**Structure:**
1. Title + tagline: "Edicts — Ground truth for AI agents"
2. One-paragraph problem statement — agents hallucinate without cheap verified facts
3. Quick start (30-second) — npm install, create YAML, `npx edicts list`, inject into prompt
4. "Why Edicts?" — 3-4 bullet differentiators, link to blog post
5. Key features — concise list
6. Configuration overview — annotated `EdictStoreOptions` (common options only)
7. YAML schema example — realistic 3-edict example with different TTL types
8. Framework integration — "Any framework" (5 lines) + "OpenClaw" (plugin config JSON), both link to edicts.ai
9. Documentation links — to edicts.ai sections
10. Contributing — link to CONTRIBUTING.md
11. License — MIT

**Tone:** Direct, developer-friendly. ~250 lines.

### 2. Generic Integration Guide

**File:** `edicts.ai/src/content/docs/docs/integrations/generic.mdx`
**Also requires:** Sidebar update in `astro.config.mjs`

**Structure:**
1. Intro — framework-agnostic, three patterns
2. Pattern 1: System prompt injection — load, render, concatenate. 10 lines.
3. Pattern 2: Tool-based access — wrap store methods as function-calling tools
4. Pattern 3: Hybrid — inject + tools (replicates OpenClaw plugin in ~50 lines)
5. Lifecycle — when to call load(), autoSave implications, concurrent agents
6. Custom tokenizer — plug in gpt-tokenizer or tiktoken
7. Custom renderer — match your framework's prompt format

**Does NOT cover:** Framework-specific adapter code (no LangChain `Tool` class etc.)
**~200 lines of mdx.**

### 3. CLI Reference

**File:** `edicts.ai/src/content/docs/docs/reference/cli.mdx`
**Also requires:** Sidebar update in `astro.config.mjs`

**Structure:**
1. Intro — "convenience tool, API is primary interface"
2. Global flags — `--path`, `--format`
3. `edicts add` — all flags (--text, --category, --key, --source, --confidence, --ttl, --expiresAt, --expiresIn, --tags), realistic example with output
4. `edicts list` — default plain + `--json` flag, example of both
5. `edicts stats` — JSON output example
6. "Not yet in CLI" callout — get, remove, search, update, review, compact. Link to API.

**~100 lines of mdx.**

### 4. Blog Post

**File:** `docs/blog/why-we-built-edicts.md` (edicts repo)

**Structure:**
1. Hook — real failure story (agent tweeted wrong version)
2. The problem — injecting verified facts is too expensive for lightweight agents
3. The landscape — Mem0 (conversational recall), Cognee (knowledge graphs), RAG (overkill), system prompt stuffing (too expensive)
4. The insight — 90% of ground truth needs are flat: category → fact → confidence → expiry
5. What Edicts does — core idea walkthrough, 12 tokens per edict
6. Memory hierarchy — where Edicts sits
7. What we learned — production lessons (negative assertions, TTL hygiene, key-based supersession)
8. Closing — links to edicts.ai, GitHub, MIT

**Tone:** First-person plural, narrative, opinionated. 1200-1500 words.

### 5. CONTRIBUTING.md

**File:** `CONTRIBUTING.md` (edicts repo root)

**Structure:**
1. Welcome
2. Dev setup — clone, npm install, npm test, npm run build (tsup, NOT Vite)
3. Tests — vitest run, vitest watch, all 168+ must pass
4. Code style — TypeScript strict, structuredClone() for returns, atomic writes
5. Making changes — fork, branch, test, PR
6. Adding tests — mirror structure, temp directories
7. What we want — bug fixes, test coverage, docs
8. What we don't want — framework adapters in core, heavy dependencies

**~80 lines.**

## Sidebar changes (astro.config.mjs)

Add to Reference section:
```
{ label: 'CLI', slug: 'docs/reference/cli' },
```

Add to Integrations section:
```
{ label: 'Generic / Any Framework', slug: 'docs/integrations/generic' },
```

## Source material

| Source | Location | Purpose |
|--------|----------|---------|
| EdictStore API | `src/store.ts` (745 lines) | Method signatures, behavior, error classes |
| Types | `src/types.ts` | All public types |
| CLI | `src/cli.ts` (76 lines) | Exact flags and commands |
| Renderers | `src/renderer.ts` | Output format details |
| Existing API ref | `edicts.ai/.../reference/api.mdx` | Already comprehensive — don't duplicate |
| Existing guides | `edicts.ai/.../guides/` | Best practices, memory hierarchy — don't duplicate |
| Existing OpenClaw guide | `edicts.ai/.../integrations/openclaw.mdx` | Full plugin config — don't duplicate |
| package.json | `package.json` | Version, exports, bin, engines |

## Out of scope

- Typedoc-generated API reference (decided against)
- LangChain/CrewAI/AutoGen adapter code (no adapters exist)
- Changelog (not part of task)
- edicts.ai marketing page updates (separate task)

## File tree after completion

```
edicts/
├── README.md                     ← REWRITTEN
├── CONTRIBUTING.md               ← NEW
├── docs/
│   └── blog/
│       └── why-we-built-edicts.md  ← NEW
└── ...

edicts.ai/
├── astro.config.mjs              ← UPDATED (sidebar)
└── src/content/docs/docs/
    ├── reference/
    │   └── cli.mdx               ← NEW
    └── integrations/
        └── generic.mdx           ← NEW
```
