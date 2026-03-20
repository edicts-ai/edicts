import { describe, it, expect } from 'vitest';
import { buildBeforePromptBuildResult, renderPromptContext, selectEdictsForPrompt } from '../../src/openclaw/context.js';
import type { Edict } from '../../src/types.js';

function edict(overrides: Partial<Edict>): Edict {
  return {
    id: 'e_001',
    text: 'Alpha',
    category: 'product',
    tags: ['launch'],
    confidence: 'verified',
    source: 'test',
    ttl: 'durable',
    created: '2026-03-20T00:00:00.000Z',
    updated: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('OpenClaw context helpers', () => {
  it('filters prompt edicts by category, tag, confidence, and max count', () => {
    const items = [
      edict({ id: 'e_001', category: 'product', tags: ['launch'], confidence: 'verified', updated: '2026-03-20T12:00:00.000Z' }),
      edict({ id: 'e_002', category: 'team', tags: ['internal'], confidence: 'user', updated: '2026-03-20T13:00:00.000Z' }),
      edict({ id: 'e_003', category: 'product', tags: ['launch', 'urgent'], confidence: 'verified', updated: '2026-03-20T14:00:00.000Z' }),
    ];

    const result = selectEdictsForPrompt(items, {
      categories: ['product'],
      tags: ['launch'],
      confidence: ['verified'],
      maxEdicts: 1,
    });

    expect(result.map((item) => item.id)).toEqual(['e_003']);
  });

  it('renders empty prompt context when no edicts match', () => {
    expect(renderPromptContext([], { emptySystemContext: 'Nothing here.' })).toBe('Nothing here.');
  });

  it('builds prepend system context with heading and markdown render', () => {
    const result = buildBeforePromptBuildResult([edict({ text: 'Michael prefers execution over talk.' })], {
      systemContextHeading: 'Edicts Context',
      renderFormat: 'markdown',
    });

    expect(result.prependSystemContext).toContain('Edicts Context:');
    expect(result.prependSystemContext).toContain('Michael prefers execution over talk.');
  });

  it('omits context when includeSystemContext is false', () => {
    const result = buildBeforePromptBuildResult([edict({})], { includeSystemContext: false });
    expect(result).toEqual({});
  });
});
