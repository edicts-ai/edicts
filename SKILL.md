---
name: openclaw-plugin-edicts
description: "Ground truth layer for AI agents — inject verified facts into every prompt and expose CRUD/search tools for runtime edict management. No more hallucinated dates, names, or constraints."
version: "1.0.2"
homepage: https://edicts.ai
license: MIT
metadata:
  author: JeanClawdVanAmsterdam
  type: plugin
  openclaw:
    emoji: "📜"
    install: "openclaw plugins install openclaw-plugin-edicts"
    requires:
      node: ">=18"
      npm: ["edicts"]
tags:
  - plugin
  - memory
  - context
  - ground-truth
  - facts
  - guardrails
---

# Edicts — Ground Truth for AI Agents

**Stop your agent from hallucinating facts that matter.**

Edicts is a lightweight ground-truth layer that injects verified facts (launch dates, product constraints, compliance rules, naming conventions, embargoes) directly into your agent's system context. Every prompt gets the facts. No retrieval stack needed.

## Install

```bash
openclaw plugins install openclaw-plugin-edicts
```

Or from ClawHub:

```bash
openclaw plugins install clawhub:openclaw-plugin-edicts
```

## What It Does

1. **Injects facts into every prompt** — edicts appear in system context automatically
2. **Exposes CRUD tools** — agents can list, add, update, remove, and search edicts at runtime
3. **Categorized and typed** — each edict has category, confidence level, TTL, and optional expiry
4. **Token-efficient** — compact YAML/JSON storage, configurable token budget and category limits

## Tools Provided

| Tool | Description |
|------|-------------|
| `edicts_list` | List edicts with optional category/tag/TTL filters |
| `edicts_add` | Create a new edict |
| `edicts_update` | Update an existing edict by ID |
| `edicts_remove` | Remove an edict |
| `edicts_search` | Free-text search across edicts |
| `edicts_stats` | Show edict store statistics |
| `edicts_review` | Review and clean up stale/expired edicts |

## Configuration

In your `openclaw.json` under `plugins.entries`:

```json
{
  "openclaw-plugin-edicts": {
    "enabled": true,
    "config": {
      "format": "yaml",
      "maxEdicts": 200,
      "tokenBudget": 4000,
      "autoSave": true,
      "includeSystemContext": true
    }
  }
}
```

### Key Config Options

- **format**: `yaml` or `json` — storage format
- **maxEdicts**: Maximum number of edicts (default: 200)
- **tokenBudget**: Max tokens for system context injection (default: 4000)
- **categories**: Restrict to specific categories
- **staleThresholdDays**: Days before an edict is considered stale
- **tools.enabled**: Enable/disable runtime tools (default: true)
- **tools.names**: Whitelist specific tools
- **autoSave**: Auto-persist changes (default: true)

## Edict Structure

```yaml
- text: "Product v2.0 launches April 15, NOT before."
  category: product
  confidence: verified    # verified | inferred | user
  ttl: event             # ephemeral | event | durable | permanent
  expiresAt: "2026-04-16"
  tags: [launch, dates]
```

## Use Cases

- **Launch dates** — "v2.0 launches April 15, NOT before"
- **Naming rules** — "Always call it 'Casper v2.2.0', never 'Kyoto'"
- **Compliance** — "NEVER share customer data in group chats"
- **Migration status** — "Database migration complete as of March 1"
- **Embargoes** — "Do not discuss partnership until press release on April 5"
- **Engagement rules** — "Do not engage with @trollaccount on X"

## Links

- **Docs**: https://edicts.ai
- **npm**: https://www.npmjs.com/package/openclaw-plugin-edicts
- **Core library**: https://www.npmjs.com/package/edicts
- **GitHub**: https://github.com/make-software/edicts
- **License**: MIT
