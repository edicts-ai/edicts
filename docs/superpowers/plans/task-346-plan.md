# Edicts.ai Landing Page — Implementation Plan

**Status:** ✅ Implemented — see `website/` directory for the built site.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a marketing + docs website for edicts.ai with custom Astro/Tailwind marketing pages and Starlight documentation.

**Architecture:** Astro static site with Starlight integration at `/docs/`. Custom marketing pages (`/`, `/use-cases`, `/pricing`) use Tailwind CSS. Starlight provides sidebar, search, and dark mode for docs. Single build, GitHub Pages deploy.

**Tech Stack:** Astro, Starlight, Tailwind CSS, TypeScript, Google Fonts (Inter + JetBrains Mono)

**Spec:** `docs/superpowers/specs/task-346-design.md`

**Project repo:** `/home/jeanclaude/workspace/edicts.ai`

---

## Task 1: Install Dependencies & Configure Astro + Tailwind + Starlight

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Create: `src/styles/global.css`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install Starlight, Tailwind, and related dependencies**

```bash
cd /home/jeanclaude/workspace/edicts.ai
npm install @astrojs/starlight @astrojs/tailwind tailwindcss @fontsource/inter @fontsource/jetbrains-mono
```

- [ ] **Step 2: Create Tailwind config**

Create `tailwind.config.mjs`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0f',
        'bg-surface': '#13131a',
        'bg-surface-hover': '#1c1c26',
        'border-subtle': '#2a2a35',
        'text-primary': '#ededf0',
        'text-secondary': '#9494a0',
        'accent': '#d4a843',
        'accent-hover': '#e0bc5f',
        'accent-muted': 'rgba(212, 168, 67, 0.12)',
        'code-bg': '#0f1117',
        'success': '#34d399',
        'danger': '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Create global CSS**

Create `src/styles/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply bg-bg-primary text-text-primary;
    scroll-behavior: smooth;
  }

  body {
    @apply font-sans antialiased;
  }

  code, pre {
    @apply font-mono;
  }
}
```

- [ ] **Step 4: Update Astro config with Starlight + Tailwind integrations**

Replace `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://edicts.ai',
  output: 'static',
  integrations: [
    starlight({
      title: 'Edicts',
      description: 'Ground truth layer for AI agents',
      social: {
        github: 'https://github.com/edicts-ai/edicts',
      },
      customCss: ['./src/styles/starlight.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Memory Hierarchy', slug: 'guides/memory-hierarchy' },
            { label: 'Best Practices', slug: 'guides/best-practices' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Configuration', slug: 'reference/configuration' },
            { label: 'YAML Schema', slug: 'reference/yaml-schema' },
            { label: 'API', slug: 'reference/api' },
          ],
        },
        {
          label: 'Integrations',
          items: [
            { label: 'OpenClaw', slug: 'integrations/openclaw' },
          ],
        },
      ],
    }),
    tailwind({ applyBaseStyles: false }),
  ],
});
```

- [ ] **Step 5: Create Starlight custom CSS**

Create `src/styles/starlight.css`:

```css
:root {
  --sl-color-accent-low: #1a1508;
  --sl-color-accent: #d4a843;
  --sl-color-accent-high: #e0bc5f;
  --sl-color-white: #ededf0;
  --sl-color-gray-1: #9494a0;
  --sl-color-gray-2: #2a2a35;
  --sl-color-gray-3: #1c1c26;
  --sl-color-gray-4: #13131a;
  --sl-color-gray-5: #0f1117;
  --sl-color-gray-6: #0a0a0f;
  --sl-color-black: #050508;
  --sl-font: 'Inter', system-ui, sans-serif;
  --sl-font-mono: 'JetBrains Mono', monospace;
}
```

- [ ] **Step 6: Verify build succeeds**

```bash
cd /home/jeanclaude/workspace/edicts.ai
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Starlight, Tailwind, configure theme and fonts"
```

---

## Task 2: Build Nav and Footer Components

**Files:**
- Create: `src/components/Nav.astro`
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create Nav component**

Create `src/components/Nav.astro`:

A fixed top nav bar with:
- Left: `◆ edicts` wordmark linking to `/`
- Center/right: `Use Cases`, `Docs`, `Pricing` links
- Far right: GitHub icon link (external)
- Transparent initially, solid `bg-bg-primary` on scroll (via a small inline `<script>`)
- Mobile: hamburger menu that toggles a dropdown

Implementation details:
- Use `<nav>` semantic element
- Links: `<a>` tags with Tailwind styling
- Scroll behavior: `IntersectionObserver` on a sentinel div, or small `scroll` event listener
- Mobile: hidden nav items toggled via a `<button>` with minimal JS

- [ ] **Step 2: Create Footer component**

Create `src/components/Footer.astro`:

Single row footer:
- Left: `◆ edicts` wordmark
- Center: `GitHub · npm · OpenClaw` links
- Right: `MIT License`
- Styled with `border-t border-border-subtle`, `text-text-secondary`, padding

- [ ] **Step 3: Verify components render**

Import both into `index.astro` temporarily and run `npm run dev` to verify rendering.

```bash
cd /home/jeanclaude/workspace/edicts.ai
npx astro dev --host 0.0.0.0 &
sleep 3
curl -s http://localhost:4321 | head -50
kill %1
```

Expected: HTML output includes nav and footer elements.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Nav and Footer components"
```

---

## Task 3: Build Marketing Layout

**Files:**
- Create: `src/layouts/Marketing.astro`
- Remove: `src/layouts/Layout.astro` (replaced)

- [ ] **Step 1: Create Marketing layout**

Create `src/layouts/Marketing.astro`:

```astro
---
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Ground truth layer for AI agents' } = Astro.props;
---

<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content="/og-image.png" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
  </head>
  <body class="bg-bg-primary text-text-primary min-h-screen flex flex-col">
    <Nav />
    <main class="flex-1">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Delete old Layout.astro**

```bash
rm /home/jeanclaude/workspace/edicts.ai/src/layouts/Layout.astro
```

- [ ] **Step 3: Update index.astro to use Marketing layout**

Temporarily update `src/pages/index.astro` to import `Marketing` layout and verify it works.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Marketing layout, remove old Layout"
```

---

## Task 4: Build Homepage — Hero Section

**Files:**
- Create: `src/components/Hero.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create Hero component**

Create `src/components/Hero.astro`:

- Large heading: "Declare what's true." / "Your agents will follow." (two lines)
- Subheadline: "Ground truth for AI agents — verified facts in 12 tokens, not 12,000 tokens of context window."
- Two CTA buttons: "Get Started →" (gold accent, solid) linking to `/docs/getting-started/installation`, "GitHub ↗" (ghost/outline) linking to GitHub repo
- Below CTAs: YAML code block showing a real edict example with syntax highlighting
- Full viewport height hero, content vertically centered
- Generous padding, max-width container

- [ ] **Step 2: Wire Hero into index.astro**

Update `src/pages/index.astro`:

```astro
---
import Marketing from '../layouts/Marketing.astro';
import Hero from '../components/Hero.astro';
---

<Marketing title="Edicts — Ground truth for AI agents">
  <Hero />
</Marketing>
```

- [ ] **Step 3: Verify visually**

```bash
npx astro dev --host 0.0.0.0 &
sleep 3
curl -s http://localhost:4321 | grep -i "declare what"
kill %1
```

Expected: Hero content present in HTML.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Hero section to homepage"
```

---

## Task 5: Build Homepage — Problem Statement Section

**Files:**
- Create: `src/components/ProblemStatement.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create ProblemStatement component**

Create `src/components/ProblemStatement.astro`:

Three-column grid (stacks on mobile):

| Column | Icon | Title | Text |
|--------|------|-------|------|
| 1 | 🎭 | Hallucination | Agents state fiction as fact because they lack verified ground truth |
| 2 | 💸 | Context cost | Loading full memory burns 4K+ tokens. Every session. Most of it irrelevant. |
| 3 | 🔇 | Memory gap | Too heavy for cron jobs. Too expensive for lightweight sessions. Too scattered for multi-agent. |

Below: centered summary line in `text-secondary`:
"Edicts fills the gap between expensive memory systems and no memory at all."

- Cards use `bg-surface` background with `border-subtle` border
- Emoji at large size, title in font-semibold, body in text-secondary

- [ ] **Step 2: Add to index.astro**

Add `<ProblemStatement />` after `<Hero />`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add problem statement section to homepage"
```

---

## Task 6: Build Homepage — How It Works Section

**Files:**
- Create: `src/components/HowItWorks.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create HowItWorks component**

Create `src/components/HowItWorks.astro`:

Section heading: "How it works"

Three steps in a horizontal flow (vertical on mobile), connected by lines/arrows:

```
① Declare                ② Inject                 ③ Trust
Write verified facts     Edicts renders to your    Every agent sees the
in YAML. 12 tokens       prompt automatically.     same ground truth.
per fact.                4K token budget cap.       Zero hallucination risk.
```

- Each step is a card with `bg-surface` background
- Step numbers use accent gold
- Small code/config snippet under each step:
  - Step 1: `edicts.yaml` snippet
  - Step 2: `store.render()` one-liner
  - Step 3: Multi-agent config snippet
- Connecting lines: CSS borders or SVG, accent gold, dashed

- [ ] **Step 2: Add to index.astro after ProblemStatement**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add how-it-works section to homepage"
```

---

## Task 7: Build Homepage — Use Cases Preview Section

**Files:**
- Create: `src/components/UseCaseCard.astro`
- Create: `src/components/UseCasesPreview.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create UseCaseCard component**

Create `src/components/UseCaseCard.astro`:

Props: `{ icon: string, title: string, problem: string, solution: string, tokens: number }`

Card layout:
- Icon + title on top
- Red `✗` line: the problem (styled with `text-danger`)
- Green `✓` line: the edict solution (styled with `text-success`)
- Token count in `text-secondary`
- `bg-surface` card with `border-subtle`, hover state with `bg-surface-hover`

- [ ] **Step 2: Create UseCasesPreview component**

Create `src/components/UseCasesPreview.astro`:

Section heading: "Real problems, real fixes"

Three `UseCaseCard` instances in a grid:
1. 🚀 Product Launch Coordination — "Agent tweets 'just shipped!' three days early" → "Edict: 'v2.0 launches April 15, NOT before.' — 12 tokens"
2. 🛡️ Feature Guardrails — "Support agent claims a feature that doesn't exist" → "Edict: 'Product does NOT have gas sponsorship.' — 9 tokens"
3. 🤝 Multi-Agent Consistency — "Five cron agents give contradictory answers" → "Shared edicts file: same ground truth, every session — 47 tokens"

Below: "See all use cases →" link to `/use-cases`

- [ ] **Step 3: Add to index.astro**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add use cases preview section to homepage"
```

---

## Task 8: Build Homepage — Memory Hierarchy Diagram

**Files:**
- Create: `src/components/MemoryDiagram.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create MemoryDiagram component**

Create `src/components/MemoryDiagram.astro`:

Section heading: "Where Edicts fits"

An SVG diagram showing three layers:
- Top: "Full Context (MEMORY.md, SOUL.md, LCM)" — `~4K-20K tokens` — `text-secondary` styling
- Middle: "Edicts (verified ground truth)" — `~200-4K tokens` — highlighted with accent gold background, gold border
- Bottom: "No context (raw LLM)" — `0 tokens — hallucination territory` — `text-secondary` with `danger` accent

The SVG should be inline (not an external file) for easy theming. Clean geometric style — rounded rectangles, thin borders.

Below the diagram: a one-liner: "Cheap enough for every session. Reliable enough for every fact."

- [ ] **Step 2: Add to index.astro after UseCasesPreview**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add memory hierarchy diagram to homepage"
```

---

## Task 9: Build Homepage — Quick Start Section

**Files:**
- Create: `src/components/QuickStart.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create QuickStart component**

Create `src/components/QuickStart.astro`:

Section heading: "Get started in 30 seconds"

Two code blocks side by side on desktop (stacked on mobile):

Left: Install command
```bash
npm install edicts
```

Right: Usage
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

- Code blocks use `bg-code-bg` with `border-subtle` border
- Language labels ("bash", "typescript") in top-right corner of each block
- Syntax highlighting via Astro's built-in Shiki integration

- [ ] **Step 2: Add to index.astro as final section before footer**

- [ ] **Step 3: Verify the complete homepage builds**

```bash
npm run build
```

Expected: Clean build, `dist/index.html` contains all sections.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add quick start section to homepage"
```

---

## Task 10: Build Use Cases Page

**Files:**
- Create: `src/pages/use-cases.astro`

- [ ] **Step 1: Create use-cases page**

Create `src/pages/use-cases.astro`:

Uses `Marketing` layout. Contains five case study sections stacked vertically with alternating `bg-bg-primary` / `bg-bg-surface` backgrounds.

Each case study follows the structure from the spec:
- Category pill + TTL badge
- Title
- "The problem" — 2-3 sentences, present tense
- "The edict" — styled code/config block showing the YAML with token cost
- "The result" — one sentence, `text-success`

**Case studies:**

1. **Product Launch Coordination** — event, expiresAt
2. **Feature Existence Guardrails** — permanent, negative assertion
3. **Multi-Agent Consistency** — durable, shared file
4. **Compliance Constraints** — permanent, zero-tolerance
5. **Time-Sensitive Operations** — ephemeral, 48h auto-expire

Bottom CTA: "Ready to stop your agents from hallucinating?" with "Get Started →" button.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `dist/use-cases/index.html` exists.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add use cases page"
```

---

## Task 11: Build Pricing Page

**Files:**
- Create: `src/pages/pricing.astro`

- [ ] **Step 1: Create pricing page**

Create `src/pages/pricing.astro`:

Uses `Marketing` layout. Centered content, minimal design.

Heading: "Free. Open source. MIT licensed."

Body: "Edicts is a standalone TypeScript library. Install it, use it, ship it. No accounts, no API keys, no usage limits."

Subtext: "Part of the OpenClaw ecosystem — but works with any agent framework."

Two CTAs: `npm install edicts` (code-styled) and "View on GitHub →"

FAQ section with 3 items:
- "Is there a hosted version?" → "No. It's a file on disk. That's the point."
- "Do I need OpenClaw?" → "No. Edicts is framework-agnostic. OpenClaw has a first-party plugin."
- "What about enterprise/support?" → "Open an issue. It's MIT."

FAQ items use `<details>` / `<summary>` or simple toggle, styled with `bg-surface` cards.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `dist/pricing/index.html` exists.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add pricing page"
```

---

## Task 12: Create Starlight Documentation Content — Getting Started

**Files:**
- Create: `src/content/docs/getting-started/installation.mdx`
- Create: `src/content/docs/getting-started/quick-start.mdx`

- [ ] **Step 1: Write installation guide**

Create `src/content/docs/getting-started/installation.mdx`:

Cover:
- npm/yarn/pnpm install commands
- Create a minimal `edicts.yaml` file (copy-pasteable example)
- Verify with `npx edicts list`
- Note Node.js >= 20 requirement

- [ ] **Step 2: Write quick start guide**

Create `src/content/docs/getting-started/quick-start.mdx`:

Cover:
- Add three edicts with different categories and TTLs
- Load and render programmatically (TypeScript example)
- Show the rendered output
- Inject into a prompt (generic — show the rendered string being concatenated with a system prompt)

- [ ] **Step 3: Verify docs build**

```bash
npm run build
```

Expected: `dist/docs/getting-started/installation/index.html` and `dist/docs/getting-started/quick-start/index.html` exist.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add getting started guides"
```

---

## Task 13: Create Starlight Documentation Content — Guides

**Files:**
- Create: `src/content/docs/guides/memory-hierarchy.mdx`
- Create: `src/content/docs/guides/best-practices.mdx`

- [ ] **Step 1: Write memory hierarchy guide**

Cover:
- The three-layer diagram (full context → edicts → no context)
- When to use Edicts vs MEMORY.md vs daily notes vs LCM
- Token budget mental model (200-4K sweet spot)
- Decision flowchart: "Should this be an edict?" (as a text list, not an image)

- [ ] **Step 2: Write best practices guide**

Cover:
- Write edicts as assertions, not instructions
- Use `key` for facts that change (supersession pattern)
- Category discipline — keep them meaningful, use normalization
- TTL hygiene — don't let ephemeral edicts pile up
- Token budget planning — how to estimate and stay within budget
- Negative assertions ("Product does NOT have X") — when and why

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add memory hierarchy and best practices guides"
```

---

## Task 14: Create Starlight Documentation Content — Reference

**Files:**
- Create: `src/content/docs/reference/configuration.mdx`
- Create: `src/content/docs/reference/yaml-schema.mdx`
- Create: `src/content/docs/reference/api.mdx`

- [ ] **Step 1: Write configuration reference**

Cover:
- Full `EdictStoreOptions` interface — every property with type, default, description
- Source: reference `/home/jeanclaude/workspace/edicts/src/types.ts` `EdictStoreOptions` interface
- Example configurations: lightweight cron agent, full agent session, multi-category setup

- [ ] **Step 2: Write YAML schema reference**

Cover:
- `EdictFileSchema` structure (version, config, edicts, history)
- Every edict field: id, text, category, tags, confidence, source, key, ttl, expiresAt, expiresIn
- Annotated complete example YAML file
- History entries explanation
- Source: reference `/home/jeanclaude/workspace/edicts/src/types.ts` types

- [ ] **Step 3: Write API reference**

Cover:
- `EdictStore` class — constructor, all public methods
- Methods: `load()`, `save()`, `add()`, `update()`, `remove()`, `get()`, `find()`, `render()`, `review()`, `stats()`, `import()`, `export()`
- Return types: `MutationResult`, `ReviewResult`, `CapacityStatus`, `EdictStats`, `ImportResult`
- Code example for each method
- Source: reference `/home/jeanclaude/workspace/edicts/src/store.ts` and `/home/jeanclaude/workspace/edicts/src/types.ts`

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: add configuration, YAML schema, and API reference"
```

---

## Task 15: Create Starlight Documentation Content — OpenClaw Integration

**Files:**
- Create: `src/content/docs/integrations/openclaw.mdx`

- [ ] **Step 1: Write OpenClaw integration guide**

Cover:
- Plugin installation (the edicts package includes the plugin)
- `openclaw.json` configuration — full example from README
- The 7 agent tools: `edicts_list`, `edicts_get`, `edicts_add`, `edicts_update`, `edicts_remove`, `edicts_search`, `edicts_stats`
- `before_prompt_build` hook — how edicts get injected into every prompt
- Filtering options: `contextCategories`, `contextTags`, `contextConfidence`, `contextMaxEdicts`
- Full plugin config reference — every field from `openclaw.plugin.json`
- Source: reference `/home/jeanclaude/workspace/edicts/openclaw.plugin.json` and README.md

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add OpenClaw integration guide"
```

---

## Task 16: Create Favicon and OG Image

**Files:**
- Create: `public/favicon.svg`
- Create: `public/og-image.png` (or `.svg` rendered to `.png`)

- [ ] **Step 1: Create favicon SVG**

Create `public/favicon.svg`:

A small diamond shape in accent gold (`#d4a843`) on transparent background. This represents the dot on the `i` in the edicts wordmark. Simple geometric — a rotated square or four-pointed star.

- [ ] **Step 2: Create OG image**

Create a simple OG image (1200×630) with:
- Dark background (`#0a0a0f`)
- "edicts" wordmark centered
- Subtitle: "Ground truth for AI agents"
- Gold accent color

This can be an SVG converted to PNG, or a static PNG created with a script.

- [ ] **Step 3: Verify favicon appears in build**

```bash
npm run build
ls dist/favicon.svg
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add favicon and OG image"
```

---

## Task 17: Final Verification & Polish

**Files:**
- Possibly modify: any file needing fixes

- [ ] **Step 1: Full build verification**

```bash
cd /home/jeanclaude/workspace/edicts.ai
npm run build
```

Expected: Clean build, zero errors.

- [ ] **Step 2: Verify all pages exist in dist**

```bash
ls dist/index.html
ls dist/use-cases/index.html
ls dist/pricing/index.html
ls dist/docs/getting-started/installation/index.html
ls dist/docs/getting-started/quick-start/index.html
ls dist/docs/guides/memory-hierarchy/index.html
ls dist/docs/guides/best-practices/index.html
ls dist/docs/reference/configuration/index.html
ls dist/docs/reference/yaml-schema/index.html
ls dist/docs/reference/api/index.html
ls dist/docs/integrations/openclaw/index.html
```

Expected: All 11 files exist.

- [ ] **Step 3: Verify navigation links work**

Start dev server, check:
- Nav links from homepage to each page
- "← Back to edicts.ai" link from docs
- "Get Started →" CTA links to docs installation
- GitHub links open correct repo
- Use case cards link to `/use-cases`

- [ ] **Step 4: Verify mobile responsiveness**

Check that:
- Nav collapses to hamburger on narrow viewports
- Three-column sections stack vertically
- Code blocks don't overflow horizontally
- Hero text scales down appropriately

- [ ] **Step 5: Check Starlight search works**

Navigate to `/docs/`, use the search box, verify it finds content across all doc pages.

- [ ] **Step 6: Fix any issues found**

Address any build errors, broken links, or visual issues.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: final polish and verification"
```

- [ ] **Step 8: Push to trigger GitHub Pages deploy**

```bash
git push origin main
```

Expected: GitHub Actions workflow triggers and deploys to GitHub Pages.
