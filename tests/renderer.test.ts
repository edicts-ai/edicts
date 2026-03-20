import { describe, it, expect } from 'vitest';
import { renderPlain, renderMarkdown, renderJson } from '../src/renderer.js';
import type { Edict } from '../src/types.js';

const sampleEdicts: Edict[] = [
  {
    id: 'product-v2-status',
    text: 'Product v2.0 launches April 15, 2026',
    category: 'product',
    tags: ['launch', 'v2'],
    confidence: 'verified',
    source: 'CEO directive',
    key: 'product-v2-status',
    ttl: 'event',
    expiresAt: '2026-04-16T00:00:00Z',
    created: '2026-03-20T06:00:00Z',
    updated: '2026-03-20T06:00:00Z',
  },
  {
    id: 'e_001',
    text: 'Engineering team is 12 people',
    category: 'team',
    tags: ['headcount'],
    confidence: 'inferred',
    source: 'standup notes',
    ttl: 'durable',
    created: '2026-03-20T06:00:00Z',
    updated: '2026-03-20T06:00:00Z',
  },
];

describe('renderPlain', () => {
  it('renders one edict per line with metadata', () => {
    const output = renderPlain(sampleEdicts);
    expect(output).toContain('Product v2.0 launches April 15, 2026');
    expect(output).toContain('[verified]');
    expect(output).toContain('[inferred]');
    expect(output).toContain('product');
  });

  it('returns empty string for no edicts', () => {
    expect(renderPlain([])).toBe('');
  });
});

describe('renderMarkdown', () => {
  it('renders with header and grouped by category', () => {
    const output = renderMarkdown(sampleEdicts);
    expect(output).toContain('# Edicts');
    expect(output).toContain('## product');
    expect(output).toContain('## team');
    expect(output).toContain('Product v2.0 launches April 15, 2026');
  });

  it('returns empty message for no edicts', () => {
    const output = renderMarkdown([]);
    expect(output).toContain('No edicts');
  });
});

describe('renderJson', () => {
  it('returns valid JSON array', () => {
    const output = renderJson(sampleEdicts);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('product-v2-status');
  });

  it('returns empty array for no edicts', () => {
    const output = renderJson([]);
    expect(JSON.parse(output)).toEqual([]);
  });
});
