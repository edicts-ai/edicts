# Task 347 — Implementation Plan

## Spec: `docs/superpowers/specs/task-347-design.md`

## Steps

### Step 1: README.md rewrite
**File:** `README.md`
**Action:** Replace entire file
**Dependencies:** None — references edicts.ai URLs (already live) and CONTRIBUTING.md (created in step 5)
**Verification:** Read final file, confirm no OpenClaw-centric framing, confirm all code examples are self-contained

### Step 2: Generic Integration Guide
**File:** `../edicts.ai/src/content/docs/docs/integrations/generic.mdx`
**Action:** Create new file
**Dependencies:** None
**Verification:** Read final file, confirm three integration patterns are complete with code examples

### Step 3: CLI Reference
**File:** `../edicts.ai/src/content/docs/docs/reference/cli.mdx`
**Action:** Create new file
**Source:** `src/cli.ts` for exact flags/commands
**Dependencies:** None
**Verification:** Read final file, cross-check every flag against cli.ts source

### Step 4: Update astro.config.mjs sidebar
**File:** `../edicts.ai/astro.config.mjs`
**Action:** Add CLI to Reference section, Generic to Integrations section
**Dependencies:** Steps 2 and 3 (files must exist)
**Verification:** Read final config, confirm slugs match file paths

### Step 5: CONTRIBUTING.md
**File:** `CONTRIBUTING.md`
**Action:** Create new file
**Dependencies:** None
**Verification:** Read final file

### Step 6: Blog Post
**File:** `docs/blog/why-we-built-edicts.md`
**Action:** Create new file, create `docs/blog/` directory
**Dependencies:** None
**Verification:** Read final file, confirm 1200-1500 word count, confirm no code tutorial content

### Step 7: Final review
**Action:** Read all 6 files in sequence, check cross-references (README links to edicts.ai, edicts.ai links between pages, README links to CONTRIBUTING.md)
**Dependencies:** All previous steps

## Execution order

Steps 1-3, 5-6 are independent — can be written in any order.
Step 4 depends on 2 and 3.
Step 7 depends on all.

Recommended: 1 → 2 → 3 → 4 → 5 → 6 → 7 (natural flow, README first sets the tone)
