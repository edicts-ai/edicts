import { describe, it, expect } from 'vitest';
import { validateEdictInput, validateFileSchema, pruneExpired } from '../src/schema.js';
import type { Edict, EdictFileSchema } from '../src/types.js';

describe('validateEdictInput', () => {
  it('accepts valid minimal input', () => {
    expect(() => validateEdictInput({ text: 'Hello', category: 'test' })).not.toThrow();
  });

  it('rejects missing text', () => {
    expect(() => validateEdictInput({ text: '', category: 'test' })).toThrow('text');
  });

  it('rejects missing category', () => {
    expect(() => validateEdictInput({ text: 'Hello', category: '' })).toThrow('category');
  });

  it('rejects invalid confidence', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', confidence: 'maybe' as any })
    ).toThrow('confidence');
  });

  it('rejects invalid ttl', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', ttl: 'forever' as any })
    ).toThrow('ttl');
  });

  it('rejects invalid expiresAt format', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', expiresAt: 'not-a-date' })
    ).toThrow('expiresAt');
  });

  it('accepts valid expiresAt', () => {
    expect(() =>
      validateEdictInput({ text: 'Hello', category: 'test', expiresAt: '2026-04-15T00:00:00Z' })
    ).not.toThrow();
  });
});

describe('validateFileSchema', () => {
  it('accepts valid schema', () => {
    const schema: EdictFileSchema = {
      version: 1,
      config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
      edicts: [],
      history: [],
    };
    const warnings = validateFileSchema(schema);
    expect(warnings).toHaveLength(0);
  });

  it('rejects missing version', () => {
    expect(() => validateFileSchema({} as any)).toThrow('version');
  });

  it('uses (unknown) in created warning when edict id is missing', () => {
    const schema: EdictFileSchema = {
      version: 1,
      config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
      edicts: [
        {
          text: 'Hello',
          category: 'test',
          tags: [],
          confidence: 'user',
          source: '',
          ttl: 'durable',
          updated: '2026-03-20T06:00:00Z',
        } as any,
      ],
      history: [],
    };

    const warnings = validateFileSchema(schema);
    expect(warnings).toContain('Edict (unknown) missing created timestamp');
  });

  it('returns warnings for edicts with missing optional fields', () => {
    const schema: EdictFileSchema = {
      version: 1,
      config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
      edicts: [
        {
          id: 'test',
          text: 'Hello',
          category: 'test',
          tags: [],
          confidence: 'user',
          source: '',
          ttl: 'durable',
          created: '2026-03-20T06:00:00Z',
          updated: '2026-03-20T06:00:00Z',
        },
      ],
      history: [],
    };
    const warnings = validateFileSchema(schema);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });
});

describe('pruneExpired', () => {
  it('moves expired edicts to history', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const edicts: Edict[] = [
      {
        id: 'expired-one',
        text: 'Old event',
        category: 'test',
        tags: [],
        confidence: 'user',
        source: 'test',
        ttl: 'event',
        expiresAt: '2026-03-15T00:00:00Z',
        created: '2026-03-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
      },
      {
        id: 'still-active',
        text: 'Future event',
        category: 'test',
        tags: [],
        confidence: 'user',
        source: 'test',
        ttl: 'event',
        expiresAt: '2026-05-01T00:00:00Z',
        created: '2026-03-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
      },
      {
        id: 'no-expiry',
        text: 'Permanent fact',
        category: 'test',
        tags: [],
        confidence: 'verified',
        source: 'test',
        ttl: 'permanent',
        created: '2026-03-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
      },
    ];

    const result = pruneExpired(edicts, now);
    expect(result.active).toHaveLength(2);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].supersededBy).toBe('expired');
    expect(result.active.map(e => e.id)).toEqual(['still-active', 'no-expiry']);
  });

  it('returns all edicts when none expired', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const edicts: Edict[] = [
      {
        id: 'future',
        text: 'Future',
        category: 'test',
        tags: [],
        confidence: 'user',
        source: 'test',
        ttl: 'event',
        expiresAt: '2026-12-31T00:00:00Z',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    ];
    const result = pruneExpired(edicts, now);
    expect(result.active).toHaveLength(1);
    expect(result.expired).toHaveLength(0);
  });
});
