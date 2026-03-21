# GitHub Repository Setup & CI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up CI/CD workflows for all three Edicts repos — core library, OpenClaw plugin, and website.

**Architecture:** GitHub Actions workflows with Node 20, npm caching, provenance-enabled npm publish on tags, and Astro + GitHub Pages for the website.

**Tech Stack:** GitHub Actions, Node 20, npm, tsup, vitest, Astro, GitHub Pages

**Spec:** `docs/superpowers/specs/task-348-design.md`

---

## File Map

### `edicts` repo (`/home/jeanclaude/workspace/edicts`)
- Create: `.github/workflows/ci.yml` — CI pipeline (lint, test, build)
- Create: `.github/workflows/publish.yml` — npm publish on tag

### `openclaw-plugin-edicts` repo (`/home/jeanclaude/workspace/openclaw-plugin-edicts`)
- Create: `.github/workflows/ci.yml` — CI pipeline with dependency override
- Create: `.github/workflows/publish.yml` — npm publish on tag

### `edicts.ai` repo (`/home/jeanclaude/workspace/edicts.ai`)
- Create: entire repo scaffold (package.json, astro.config.mjs, tsconfig.json, src/, public/)
- Create: `.github/workflows/deploy.yml` — build + deploy to GitHub Pages

---

## Chunk 1: `edicts` Core Library CI

### Task 1: Create CI workflow

**Files:**
- Create: `/home/jeanclaude/workspace/edicts/.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p /home/jeanclaude/workspace/edicts/.github/workflows
```

- [ ] **Step 2: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

- [ ] **Step 3: Verify the workflow is valid YAML**

```bash
cd /home/jeanclaude/workspace/edicts
cat .github/workflows/ci.yml
# Visually confirm: valid YAML, correct indentation, no syntax errors
```

### Task 2: Create publish workflow

**Files:**
- Create: `/home/jeanclaude/workspace/edicts/.github/workflows/publish.yml`

- [ ] **Step 1: Write the publish workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Publish
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Verify the workflow is valid YAML**

```bash
cd /home/jeanclaude/workspace/edicts
cat .github/workflows/publish.yml
# Confirm: valid YAML, tag trigger correct, NPM_TOKEN reference, provenance flag
```

### Task 3: Commit and push

- [ ] **Step 1: Commit the CI workflows**

```bash
cd /home/jeanclaude/workspace/edicts
git add .github/workflows/ci.yml .github/workflows/publish.yml
git commit -m "ci: add CI and publish workflows"
```

- [ ] **Step 2: Push to remote**

```bash
cd /home/jeanclaude/workspace/edicts
git push origin master
```

- [ ] **Step 3: Verify push succeeded**

```bash
cd /home/jeanclaude/workspace/edicts
git log --oneline -1
# Confirm: latest commit is the CI commit
```

---

## Chunk 2: `openclaw-plugin-edicts` Plugin CI

### Task 4: Create CI workflow with dependency override

**Files:**
- Create: `/home/jeanclaude/workspace/openclaw-plugin-edicts/.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p /home/jeanclaude/workspace/openclaw-plugin-edicts/.github/workflows
```

- [ ] **Step 2: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Use published edicts (not local file: link)
        run: npm pkg set dependencies.edicts=">=0.1.0"

      - run: npm install

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

- [ ] **Step 3: Verify the workflow is valid YAML**

```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts
cat .github/workflows/ci.yml
# Confirm: dependency override step is present, uses npm install (not ci, since we modified package.json)
```

### Task 5: Create publish workflow

**Files:**
- Create: `/home/jeanclaude/workspace/openclaw-plugin-edicts/.github/workflows/publish.yml`

- [ ] **Step 1: Write the publish workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org

      - name: Use published edicts (not local file: link)
        run: npm pkg set dependencies.edicts=">=0.1.0"

      - run: npm install

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Publish
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Verify the workflow is valid YAML**

```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts
cat .github/workflows/publish.yml
```

### Task 6: Commit and push

- [ ] **Step 1: Commit the CI workflows**

```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts
git add .github/workflows/ci.yml .github/workflows/publish.yml
git commit -m "ci: add CI and publish workflows"
```

- [ ] **Step 2: Push to remote**

```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts
git push origin master
```

- [ ] **Step 3: Verify push succeeded**

```bash
cd /home/jeanclaude/workspace/openclaw-plugin-edicts
git log --oneline -1
```

---

## Chunk 3: `edicts.ai` Website — Repo Creation & Scaffold

### Task 7: Create the GitHub repository

- [ ] **Step 1: Create the repo via GitHub API**

```bash
TOKEN=$(cd /home/jeanclaude/workspace/edicts && git remote get-url origin | grep -oP 'github_pat_[^@]+')
curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d '{
    "name": "edicts.ai",
    "description": "Website and documentation for Edicts — ground truth layer for AI agents",
    "homepage": "https://edicts.ai",
    "private": false,
    "has_issues": true,
    "has_projects": false,
    "has_wiki": false,
    "auto_init": false
  }'
```

Expected: 201 Created with repo URL `https://github.com/mssteuer/edicts.ai`

- [ ] **Step 2: Verify repo was created**

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $TOKEN" https://api.github.com/repos/mssteuer/edicts.ai
```

Expected: `200`

### Task 8: Scaffold the Astro project

- [ ] **Step 1: Create local directory structure**

```bash
mkdir -p /home/jeanclaude/workspace/edicts.ai/src/layouts
mkdir -p /home/jeanclaude/workspace/edicts.ai/src/pages
mkdir -p /home/jeanclaude/workspace/edicts.ai/public
mkdir -p /home/jeanclaude/workspace/edicts.ai/.github/workflows
```

- [ ] **Step 2: Write `package.json`**

Create `/home/jeanclaude/workspace/edicts.ai/package.json`:

```json
{
  "name": "edicts-website",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^5.7.0"
  }
}
```

- [ ] **Step 3: Write `astro.config.mjs`**

Create `/home/jeanclaude/workspace/edicts.ai/astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://edicts.ai',
  output: 'static',
});
```

- [ ] **Step 4: Write `tsconfig.json`**

Create `/home/jeanclaude/workspace/edicts.ai/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict"
}
```

- [ ] **Step 5: Write `.gitignore`**

Create `/home/jeanclaude/workspace/edicts.ai/.gitignore`:

```
node_modules/
dist/
.astro/
```

- [ ] **Step 6: Write the base layout**

Create `/home/jeanclaude/workspace/edicts.ai/src/layouts/Layout.astro`:

```astro
---
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Edicts — Ground truth layer for AI agents" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 7: Write the landing page**

Create `/home/jeanclaude/workspace/edicts.ai/src/pages/index.astro`:

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Edicts — Ground truth for AI agents">
  <main>
    <h1>Edicts</h1>
    <p>Ground truth layer for AI agents.</p>
    <p><a href="https://github.com/mssteuer/edicts">GitHub</a> · <a href="https://www.npmjs.com/package/edicts">npm</a></p>
  </main>
</Layout>
```

- [ ] **Step 8: Write LICENSE**

Create `/home/jeanclaude/workspace/edicts.ai/LICENSE`:

```
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
```

- [ ] **Step 9: Install dependencies and verify build**

```bash
cd /home/jeanclaude/workspace/edicts.ai
npm install
npm run build
```

Expected: `dist/` directory created with static HTML output.

### Task 9: Create deploy workflow

**Files:**
- Create: `/home/jeanclaude/workspace/edicts.ai/.github/workflows/deploy.yml`

- [ ] **Step 1: Write the deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build
        run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the workflow is valid YAML**

```bash
cd /home/jeanclaude/workspace/edicts.ai
cat .github/workflows/deploy.yml
```

### Task 10: Initialize git, commit, and push

- [ ] **Step 1: Initialize git repo**

```bash
cd /home/jeanclaude/workspace/edicts.ai
git init
git branch -M main
```

- [ ] **Step 2: Configure git remote**

```bash
cd /home/jeanclaude/workspace/edicts.ai
TOKEN=$(cd /home/jeanclaude/workspace/edicts && git remote get-url origin | grep -oP 'github_pat_[^@]+')
git remote add origin "https://x-access-token:${TOKEN}@github.com/mssteuer/edicts.ai.git"
```

- [ ] **Step 3: Commit all files**

```bash
cd /home/jeanclaude/workspace/edicts.ai
git add -A
git commit -m "feat: initial Astro scaffold with GitHub Pages deploy"
```

- [ ] **Step 4: Push to remote**

```bash
cd /home/jeanclaude/workspace/edicts.ai
git push -u origin main
```

- [ ] **Step 5: Verify push succeeded**

```bash
cd /home/jeanclaude/workspace/edicts.ai
git log --oneline -1
```

### Task 11: Enable GitHub Pages via API

- [ ] **Step 1: Set Pages source to GitHub Actions**

```bash
TOKEN=$(cd /home/jeanclaude/workspace/edicts && git remote get-url origin | grep -oP 'github_pat_[^@]+')
curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/mssteuer/edicts.ai/pages \
  -d '{"build_type": "workflow"}'
```

Expected: 201 Created or 409 (already configured).

- [ ] **Step 2: Verify Pages is enabled**

```bash
curl -s -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/mssteuer/edicts.ai/pages \
  | grep -E '"status"|"url"'
```

---

## Chunk 4: Final Verification

### Task 12: Verify all repos have workflows

- [ ] **Step 1: Verify `edicts` workflows exist on GitHub**

```bash
TOKEN=$(cd /home/jeanclaude/workspace/edicts && git remote get-url origin | grep -oP 'github_pat_[^@]+')
curl -s -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/mssteuer/edicts/actions/workflows \
  | grep '"name"'
```

Expected: Shows "CI" and "Publish" workflows.

- [ ] **Step 2: Verify `openclaw-plugin-edicts` workflows exist on GitHub**

```bash
curl -s -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/mssteuer/openclaw-plugin-edicts/actions/workflows \
  | grep '"name"'
```

Expected: Shows "CI" and "Publish" workflows.

- [ ] **Step 3: Verify `edicts.ai` workflow exists on GitHub**

```bash
curl -s -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/mssteuer/edicts.ai/actions/workflows \
  | grep '"name"'
```

Expected: Shows "Deploy to GitHub Pages" workflow.

- [ ] **Step 4: Check if CI ran on push for `edicts`**

```bash
curl -s -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/mssteuer/edicts/actions/runs?per_page=1" \
  | grep -E '"status"|"conclusion"|"name"'
```

Expected: CI run triggered, status shows "completed" or "in_progress".

---

## Manual Steps (for Michael)

These require account-level access and cannot be automated:

1. **NPM_TOKEN secret** — Add to both `mssteuer/edicts` and `mssteuer/openclaw-plugin-edicts`:
   - Go to repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `NPM_TOKEN`, Value: npm access token with publish permission
   - Generate token at https://www.npmjs.com/settings/tokens

2. **Custom domain** (optional, later) — To use `edicts.ai` with GitHub Pages:
   - Add CNAME record: `edicts.ai` → `mssteuer.github.io`
   - Add `CNAME` file to `public/` with content `edicts.ai`
   - Enable "Enforce HTTPS" in repo Pages settings
