import { describe, it, expect } from 'vitest';
import { getDefaultToolNames, normalizePluginConfig, resolveEnabledToolNames, toStoreOptions } from '../../src/openclaw/config.js';

describe('OpenClaw plugin config helpers', () => {
  it('supplies sensible defaults', () => {
    expect(normalizePluginConfig()).toMatchObject({
      path: './edicts.yaml',
      format: 'yaml',
      renderFormat: 'markdown',
      includeSystemContext: true,
      contextMaxEdicts: 25,
    });
  });

  it('maps plugin config to store options', () => {
    expect(toStoreOptions({ path: './x.json', format: 'json', tokenBudget: 123, autoSave: false })).toMatchObject({
      path: './x.json',
      format: 'json',
      tokenBudget: 123,
      autoSave: false,
    });
  });

  it('returns all default tool names when tools config is absent', () => {
    expect(resolveEnabledToolNames()).toEqual(getDefaultToolNames());
  });

  it('returns no tools when explicitly disabled', () => {
    expect(resolveEnabledToolNames({ tools: { enabled: false } })).toEqual([]);
  });

  it('filters configured tool names against the known set', () => {
    expect(resolveEnabledToolNames({ tools: { names: ['edicts_list', 'edicts_stats'] } })).toEqual(['edicts_list', 'edicts_stats']);
  });
});
