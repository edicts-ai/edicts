# Edicts

Ground truth layer for AI agents.

https://edicts.ai

## OpenClaw integration

This package now includes `openclaw-plugin-edicts`, an OpenClaw plugin adapter that:

- registers 7 agent tools:
  - `edicts_list`
  - `edicts_get`
  - `edicts_add`
  - `edicts_update`
  - `edicts_remove`
  - `edicts_search`
  - `edicts_stats`
- injects rendered edicts into prompt construction via the `before_prompt_build` hook
- exposes plugin configuration through `openclaw.plugin.json`

### Example OpenClaw config

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

### Programmatic exports

```ts
import {
  openclawPluginEdicts,
  createEdictsTools,
  buildBeforePromptBuildResult,
} from 'edicts';
```


## OpenClaw adapter exports

In addition to the primary plugin entrypoints, the OpenClaw adapter also exports supporting utilities such as `normalizePluginConfig`, `createEdictsTools`, `edictsPluginConfigSchema`, and `buildBeforePromptBuildResult` for advanced integration and testing use cases.
