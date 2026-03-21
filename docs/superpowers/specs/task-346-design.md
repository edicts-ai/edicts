# Edicts.ai Landing Page Website — Design Spec

**Task:** #346  
**Date:** 2026-03-21  
**Status:** Approved  

---

## Overview

Build a marketing and documentation website for edicts.ai — the landing page for the Edicts library ("Ground truth layer for AI agents"). The site has two distinct parts: custom marketing pages with a developer-focused aesthetic, and a Starlight-powered documentation section.

**Positioning:** Framework-agnostic on the homepage, with deep OpenClaw integration coverage in the docs. The use cases are written generically but clearly inspired by real agent workflows.

## Tech Stack

- **Framework:** Astro (already scaffolded at `/home/jeanclaude/workspace/edicts.ai`)
- **Docs engine:** Starlight (Astro integration), mounted at `/docs/`
- **Styling:** Tailwind CSS for marketing pages; Starlight's built-in theming for docs
- **Fonts:** Inter (headings + body), JetBrains Mono (code) via Google Fonts
- **Build:** `astro build` → static output
- **Deploy:** GitHub Pages (CI already configured)
- **Domain:** edicts.ai
- **Client-side JS:** None unless explicitly needed. Pure Astro components.

## Architecture

### Approach

Starlight integration at `/docs/*` for documentation. Custom Astro + Tailwind pages for marketing (`/`, `/use-cases`, `/pricing`). Single repo, single build, single deploy. Marketing pages use a shared `Marketing.astro` layout. Starlight manages its own layout for docs.

### Site Map

```
edicts.ai/
├── /                    ← Marketing homepage (custom Astro + Tailwind)
├── /use-cases           ← Detailed use case stories (custom page)
├── /pricing             ← Open source / ecosystem positioning (custom page)
└── /docs/               ← Starlight documentation site
    ├── /docs/getting-started/
    │   ├── installation
    │   └── quick-start
    ├── /docs/guides/
    │   ├── memory-hierarchy
    │   └── best-practices
    ├── /docs/reference/
    │   ├── configuration
    │   ├── yaml-schema
    │   └── api
    └── /docs/integrations/
        └── openclaw
```

### File Structure

```
edicts.ai/
├── astro.config.mjs          ← Astro + Starlight + Tailwind config
├── tailwind.config.mjs
├── src/
│   ├── layouts/
│   │   └── Marketing.astro   ← Shared layout for marketing pages (nav + footer)
│   ├── components/
│   │   ├── Nav.astro          ← Top navigation bar
│   │   ├── Footer.astro       ← Site footer
│   │   ├── Hero.astro         ← Homepage hero section
│   │   ├── HowItWorks.astro   ← 3-step visual
│   │   ├── UseCaseCard.astro  ← Reusable use case preview card
│   │   ├── CodeBlock.astro    ← Styled code snippet component
│   │   └── MemoryDiagram.astro ← Memory hierarchy SVG diagram
│   ├── pages/
│   │   ├── index.astro        ← Homepage
│   │   ├── use-cases.astro    ← Use cases page
│   │   └── pricing.astro      ← Pricing page
│   ├── content/
│   │   └── docs/              ← Starlight MDX content
│   │       ├── getting-started/
│   │       │   ├── installation.mdx
│   │       │   └── quick-start.mdx
│   │       ├── guides/
│   │       │   ├── memory-hierarchy.mdx
│   │       │   └── best-practices.mdx
│   │       ├── reference/
│   │       │   ├── configuration.mdx
│   │       │   ├── yaml-schema.mdx
│   │       │   └── api.mdx
│   │       └── integrations/
│   │           └── openclaw.mdx
│   └── styles/
│       └── global.css         ← Tailwind base + custom tokens
├── public/
│   ├── favicon.svg
│   └── og-image.png           ← Social sharing image
└── .github/workflows/
    └── deploy.yml             ← GitHub Pages (already exists)
```

### Navigation

- **Marketing pages:** Fixed nav bar — `[◆ edicts]  Use Cases  Docs  Pricing  [GitHub ↗]`
  - Transparent on hero, solid `bg-primary` on scroll
- **Docs pages:** Starlight's default header with a "← Back to edicts.ai" link added
- The nav component is shared; Starlight gets a customized header override

## Visual Identity

### Color Palette (dark-mode default)

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#0a0a0f` | Page background — near-black with slight blue undertone |
| `bg-surface` | `#13131a` | Cards, code blocks, elevated surfaces |
| `bg-surface-hover` | `#1c1c26` | Interactive surface hover states |
| `border-subtle` | `#2a2a35` | Dividers, card borders |
| `text-primary` | `#ededf0` | Headings, body text |
| `text-secondary` | `#9494a0` | Muted text, descriptions |
| `accent` | `#d4a843` | Gold/amber — CTAs, links, emphasis. The "edict" color. |
| `accent-hover` | `#e0bc5f` | Hover state for accent |
| `accent-muted` | `#d4a84320` | Accent at 12% opacity — subtle highlights, badges |
| `code-bg` | `#0f1117` | Code block backgrounds |
| `success` | `#34d399` | "Before/after" positive states in use cases |
| `danger` | `#f87171` | "Before/after" problem states in use cases |

### Typography

- **Headings:** Inter, weight 700/600
- **Body:** Inter, weight 400
- **Code:** JetBrains Mono with ligatures
- Loaded from Google Fonts (two families)

### Logo

- Typographic wordmark: "edicts" in Inter 700, lowercase
- The dot on the `i` replaced with a small diamond/stamp shape in accent gold
- Used in nav bar and as favicon (just the diamond)
- No separate icon or mascot

### Personality

- Sparse, high-contrast. Generous whitespace.
- Code examples are the visual centerpiece
- Motion: minimal — subtle fade-ins on scroll, nothing gratuitous
- Gold accent used sparingly — highlight, not theme park

## Page Designs

### Homepage (`/`)

**Top-to-bottom flow:**

#### 1. Hero

```
Declare what's true.
Your agents will follow.

Ground truth for AI agents — verified facts in 12 tokens,
not 12,000 tokens of context window.

[Get Started →]  [GitHub ↗]
```

- Headline: large Inter 700, two lines
- Subheadline: `text-secondary`, emphasizes token efficiency
- Two CTAs: primary (accent gold → `/docs/getting-started/installation`) and secondary (ghost → GitHub)
- Below CTAs: a YAML code snippet fading in showing a real edict

```yaml
# edicts.yaml — 47 tokens total
edicts:
  - id: launch_date
    text: "Product v2.0 launches April 15, NOT before."
    category: product
    confidence: verified
    ttl: event
    expiresAt: "2025-04-16"
```

#### 2. Problem Statement

Three columns with emoji icons:

| 🎭 Hallucination | 💸 Context cost | 🔇 Memory gap |
|---|---|---|
| Agents state fiction as fact because they lack verified ground truth | Loading full memory burns 4K+ tokens. Every session. Most of it irrelevant. | Too heavy for cron jobs. Too expensive for lightweight sessions. Too scattered for multi-agent. |

Below: `"Edicts fills the gap between expensive memory systems and no memory at all."`

#### 3. How It Works — 3-step visual

Horizontal flow with connecting lines:

```
① Declare               ② Inject                ③ Trust
Write verified facts    Edicts renders to your   Every agent sees the
in YAML. 12 tokens      prompt automatically.    same ground truth.
per fact.               4K token budget cap.      Zero hallucination risk.
```

Each step is a card with a small code/config snippet underneath.

#### 4. Use Cases Preview

Three cards linking to `/use-cases`, each with:
- Red "before" line showing the failure
- Green "after" line showing the edict fix
- Accent-colored category pill

Example:
```
🚀 Product Launch Coordination
✗ Agent tweets "just shipped!" three days early
✓ Edict: "v2.0 launches April 15, NOT before." — 12 tokens
```

#### 5. Memory Hierarchy Diagram

SVG component showing where Edicts sits:

```
┌─────────────────────────────────────┐
│  Full Context (MEMORY.md, SOUL.md)  │  ~4K-20K tokens
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  Edicts (verified ground truth)     │  ~200-4K tokens  ← you are here
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  No context (raw LLM)              │  0 tokens — hallucination territory
└─────────────────────────────────────┘
```

Gold accent highlighting the Edicts layer.

#### 6. Quick Start

```bash
npm install edicts
```
```typescript
import { EdictStore } from 'edicts';

const store = new EdictStore({ path: './edicts.yaml' });
await store.load();

const rendered = store.render();
console.log(rendered);
// ## Edicts
// - **[product]** Product v2.0 launches April 15, NOT before.
// - **[compliance]** Never mention Project X publicly.
```

#### 7. Footer

`[◆ edicts]   GitHub · npm · OpenClaw   MIT License`

Minimal, one row.

### Use Cases Page (`/use-cases`)

Five detailed case studies stacked vertically. Alternating `bg-primary` / `bg-surface` backgrounds for visual rhythm.

**Each case study structure:**

```
[Category pill]  [TTL badge: permanent | event | ephemeral]

## Title

### The problem
2-3 sentences. Present tense, second person. Specific failure scenario.

### The edict
┌──────────────────────────────────────────┐
│  text: "..."                             │
│  category: ...                           │
│  confidence: verified                    │
│  ttl: ...                                │
│  cost: N tokens                          │
└──────────────────────────────────────────┘

### The result
One sentence. Green accent. Quantified where possible.
```

**The five cases:**

1. **Product launch coordination** — event TTL, expiresAt. Agent tweets early → edict constrains timing.
2. **Feature existence guardrails** — permanent, negative assertion. Support agent claims nonexistent feature → edict blocks it.
3. **Multi-agent consistency** — durable, shared across sessions. Five cron agents diverge → edicts give shared cheat sheet.
4. **Compliance constraints** — permanent, zero-tolerance. "Never mention Project X publicly." Every agent sees it.
5. **Time-sensitive operations** — ephemeral, 48h auto-expire. Migration constraint that self-destructs.

**Bottom CTA:**
```
Ready to stop your agents from hallucinating?
[Get Started →]
```

### Pricing Page (`/pricing`)

Minimal — answers the question without selling.

```
## Free. Open source. MIT licensed.

Edicts is a standalone TypeScript library.
Install it, use it, ship it. No accounts, no API keys, no usage limits.

Part of the OpenClaw ecosystem — but works with any agent framework.

[npm install edicts]     [View on GitHub →]
```

**FAQ section (3-4 items):**
- "Is there a hosted version?" → No. It's a file on disk. That's the point.
- "Do I need OpenClaw?" → No. Edicts is framework-agnostic. OpenClaw has a first-party plugin.
- "What about enterprise/support?" → Open an issue. It's MIT.

## Documentation (Starlight)

### Starlight Configuration

- Mounted at `/docs/`
- Accent color overridden to gold `#d4a843`
- Custom header with "← Back to edicts.ai" link
- Social links: GitHub repo
- Favicon: same diamond from marketing site
- Search: Pagefind (Starlight default)

### Sidebar Structure

```
Getting Started
  ├── Installation
  └── Quick Start

Guides
  ├── Memory Hierarchy
  └── Best Practices

Reference
  ├── Configuration
  ├── YAML Schema
  └── API

Integrations
  └── OpenClaw
```

### Content Outline

#### Getting Started → Installation
- npm/yarn/pnpm install commands
- Create first `edicts.yaml` file
- Verify with `npx edicts list`

#### Getting Started → Quick Start
- Add three edicts (different categories, TTLs)
- Load and render programmatically
- Inject into a prompt (generic example, not framework-specific)

#### Guides → Memory Hierarchy
- Key diagram: where Edicts sits between "full memory" and "no memory"
- When to use Edicts vs MEMORY.md vs daily notes vs LCM
- Token budget mental model (200-4K sweet spot)
- Decision flowchart: "Should this be an edict?"

#### Guides → Best Practices
- Write edicts as assertions, not instructions
- Use `key` for facts that change (supersession)
- Category discipline
- TTL hygiene
- Token budget planning
- Negative assertions ("Product does NOT have X")

#### Reference → Configuration
- Full `EdictStoreOptions` reference with types, defaults, descriptions
- Example configurations for common scenarios

#### Reference → YAML Schema
- Complete `EdictFileSchema` with annotated example
- Every field documented
- History section explanation

#### Reference → API
- `EdictStore` class methods: `load()`, `save()`, `add()`, `update()`, `remove()`, `get()`, `find()`, `render()`, `review()`, `stats()`, `import()`, `export()`
- Return types: `MutationResult`, `ReviewResult`, `CapacityStatus`, `EdictStats`
- Code examples for each method

#### Integrations → OpenClaw
- Plugin installation and `openclaw.json` config
- The 7 agent tools with descriptions
- `before_prompt_build` hook — how edicts get injected
- Filtering: `contextCategories`, `contextTags`, `contextConfidence`
- Full plugin config reference

## Acceptance Criteria

1. All four pages render and deploy via GitHub Pages CI
2. Starlight docs build and serve at `/docs/` with working sidebar and search
3. Dark-mode-first design with the defined color palette
4. All code examples are syntactically correct and copy-pasteable
5. Memory hierarchy diagram renders as SVG
6. Navigation works between marketing pages and docs (and back)
7. Mobile responsive (nav collapses, sections stack)
8. Page load: zero client-side JS on marketing pages (unless explicitly needed)
9. Lighthouse performance score ≥ 90
10. OG image and meta tags for social sharing

## Out of Scope

- Light mode toggle (dark only for v1)
- Blog / changelog section
- Analytics / tracking
- Custom search beyond Starlight's Pagefind
- i18n / translations
- Interactive demos or playgrounds
