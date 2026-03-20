import { describe, it, expect } from 'vitest';
import type { Edict, EdictInput, HistoryEntry, EdictStoreOptions } from '../src/types.js';

describe('Type definitions', () => {
  it('EdictInput accepts minimal required fields', () => {
    const input: EdictInput = {
      text: 'Test edict',
      category: 'test',
    };
    expect(input.text).toBe('Test edict');
    expect(input.category).toBe('test');
    expect(input.key).toBeUndefined();
    expect(input.tags).toBeUndefined();
    expect(input.confidence).toBeUndefined();
    expect(input.source).toBeUndefined();
    expect(input.ttl).toBeUndefined();
    expect(input.expiresAt).toBeUndefined();
  });

  it('EdictInput accepts all optional fields', () => {
    const input: EdictInput = {
      text: 'Product v2 launches April 15',
      category: 'product',
      key: 'product-v2-status',
      tags: ['launch', 'v2'],
      confidence: 'verified',
      source: 'CEO directive',
      ttl: 'event',
      expiresAt: '2026-04-16T00:00:00Z',
    };
    expect(input.key).toBe('product-v2-status');
    expect(input.confidence).toBe('verified');
  });

  it('Edict has all required runtime fields', () => {
    const edict: Edict = {
      id: 'product-v2-status',
      text: 'Product v2 launches April 15',
      category: 'product',
      tags: ['launch'],
      confidence: 'verified',
      source: 'CEO directive',
      key: 'product-v2-status',
      ttl: 'event',
      created: '2026-03-20T06:00:00Z',
      updated: '2026-03-20T06:00:00Z',
    };
    expect(edict.id).toBe('product-v2-status');
    expect(edict.lastAccessed).toBeUndefined();
    expect(edict._tokens).toBeUndefined();
  });

  it('HistoryEntry tracks supersession', () => {
    const entry: HistoryEntry = {
      id: 'product-v2-status__20260320',
      text: 'Product v2 estimated for Q2 2026',
      supersededBy: 'product-v2-status',
      archivedAt: '2026-03-20T06:00:00Z',
    };
    expect(entry.supersededBy).toBe('product-v2-status');
  });

  it('EdictStoreOptions accepts all configuration', () => {
    const opts: EdictStoreOptions = {
      path: './edicts.yaml',
      format: 'yaml',
      maxEdicts: 200,
      tokenBudget: 4000,
      tokenizer: (text: string) => text.length / 4,
      categories: ['product', 'team'],
      renderer: (edicts: Edict[]) => edicts.map(e => e.text).join('\n'),
    };
    expect(opts.maxEdicts).toBe(200);
  });

  it('confidence only accepts valid values', () => {
    const values: Edict['confidence'][] = ['verified', 'inferred', 'user'];
    expect(values).toHaveLength(3);
  });

  it('ttl only accepts valid values', () => {
    const values: Edict['ttl'][] = ['ephemeral', 'event', 'durable', 'permanent'];
    expect(values).toHaveLength(4);
  });
});
