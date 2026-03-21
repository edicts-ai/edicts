# GitHub Repository Setup & CI — Design Spec

**Task:** #348  
**Date:** 2026-03-21  
**Status:** Approved

## Overview

Set up CI/CD pipelines for all three Edicts repositories. Two repos already exist (`edicts`, `openclaw-plugin-edicts`); one must be created (`edicts.ai`).

## Repositories

| Repo | URL | Package | Deploy Target |
|------|-----|---------|---------------|
| `edicts` | `github.com/mssteuer/edicts` | `edicts` on npm | npm publish on tag |
| `openclaw-plugin-edicts` | `github.com/mssteuer/openclaw-plugin-edicts` | `openclaw-plugin-edicts` on npm | npm publish on tag |
| `edicts.ai` | `github.com/mssteuer/edicts.ai` (to create) | N/A | GitHub Pages auto-deploy |

All repos transfer to `edicts-ai` org when created.

## 1. `edicts` — Core Library

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** push to `master`, pull requests targeting `master`

**Jobs:**
1. **ci** — single job, Node 20, ubuntu-latest
   - Checkout
   - Setup Node 20 with npm cache
   - `npm ci`
   - `npm run lint` (tsc --noEmit)
   - `npm test` (vitest run)
   - `npm run build` (tsup)

### Publish Workflow (`.github/workflows/publish.yml`)

**Trigger:** push tags matching `v*`

**Jobs:**
1. **publish** — Node 20, ubuntu-latest
   - Run full CI steps (lint, test, build)
   - `npm publish --provenance --access public`
   - Uses `NPM_TOKEN` repository secret
   - `id-token: write` permission for npm provenance

## 2. `openclaw-plugin-edicts` — Plugin

### CI Workflow (`.github/workflows/ci.yml`)

Same structure as core, with dependency override:

```yaml
- name: Use published edicts (not local file: link)
  run: npm pkg set dependencies.edicts=">=0.1.0"
- run: npm install
```

This replaces the `"edicts": "file:../edicts"` local dev link with the published npm version.

**Known issue:** `src/tools.ts:217` has a lint error. CI will correctly report this. Fix is out of scope for this task.

### Publish Workflow (`.github/workflows/publish.yml`)

Same pattern as core — tag-triggered, npm provenance, `NPM_TOKEN` secret.

## 3. `edicts.ai` — Website

### Repository Creation

Create `mssteuer/edicts.ai` as a public repo with:
- MIT license
- Astro static site scaffold
- GitHub Pages configuration

### Framework: Astro

**Rationale over Next.js:**
- Static-first by design (no SSR complexity)
- Built-in GitHub Pages adapter
- Simpler config for docs + marketing pages
- Excellent Markdown/MDX support for docs

### Scaffold Structure

```
edicts.ai/
├── .github/workflows/deploy.yml
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── src/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── public/
    └── (static assets)
```

### Deploy Workflow (`.github/workflows/deploy.yml`)

**Trigger:** push to `main`

**Jobs:**
1. **build** — Node 20, ubuntu-latest
   - Checkout
   - Setup Node 20 with npm cache
   - `npm ci`
   - `astro build`
   - Upload `dist/` as pages artifact

2. **deploy** — depends on build
   - `actions/deploy-pages@v4`
   - Environment: `github-pages`
   - Needs `pages: write`, `id-token: write` permissions

### GitHub Pages Setup

Pages source must be set to "GitHub Actions" (not branch-based). This is configured via the GitHub API after repo creation.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Node version | 20 only | Matches `engines: >=20` in package.json |
| CI runner | ubuntu-latest | Standard, fast, free for public repos |
| Website framework | Astro | Static-first, built-in Pages adapter, simpler than Next.js |
| Pages deployment | `actions/deploy-pages` | Modern approach — no `gh-pages` branch management |
| npm auth | `NPM_TOKEN` secret | Standard pattern — one-time manual setup per repo |
| Plugin CI dep | Override `file:` → npm | Ensures CI tests against published API surface |

## Acceptance Criteria

1. `edicts` repo: CI workflow runs lint, typecheck, tests, build on push/PR to default branch
2. `edicts` repo: Publish workflow publishes to npm on `v*` tag push
3. `openclaw-plugin-edicts` repo: CI workflow runs lint, typecheck, tests, build on push/PR to default branch
4. `openclaw-plugin-edicts` repo: Publish workflow publishes to npm on `v*` tag push
5. `edicts.ai` repo created at `mssteuer/edicts.ai` with Astro scaffold
6. `edicts.ai` repo: GitHub Pages deployment workflow on push to main
7. All CI workflows committed and pushed to respective repos
