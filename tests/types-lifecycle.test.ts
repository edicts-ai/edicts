import { describe, it, expect } from 'vitest';
import type {
  EdictInput,
  EdictStoreOptions,
  MutationResult,
  CapacityStatus,
  CompactionGroup,
  ReviewOptions,
  ReviewResult,
} from '../src/types.js';

describe('Lifecycle types', () => {
  it('EdictInput accepts expiresIn as string', () => {
    const input: EdictInput = { text: 'test', category: 'cat', expiresIn: '2h' };
    expect(input.expiresIn).toBe('2h');
  });

  it('EdictInput accepts expiresIn as number', () => {
    const input: EdictInput = { text: 'test', category: 'cat', expiresIn: 3600 };
    expect(input.expiresIn).toBe(3600);
  });

  it('EdictStoreOptions accepts lifecycle config', () => {
    const opts: EdictStoreOptions = {
      staleThresholdDays: 90,
      categoryLimits: { product: 30 },
      defaultCategoryLimit: 50,
      defaultEphemeralTtlSeconds: 86400,
      autoSave: false,
    };
    expect(opts.staleThresholdDays).toBe(90);
  });

  it('MutationResult accepts warnings', () => {
    const result: MutationResult = {
      action: 'created',
      pruned: 0,
      warnings: ['Store at 85% capacity'],
    };
    expect(result.warnings).toHaveLength(1);
  });

  it('CapacityStatus has expected shape', () => {
    const status: CapacityStatus = {
      countUsage: 0.85,
      tokenUsage: 0.72,
      categories: { product: { count: 25, limit: 30, overLimit: false } },
      warnings: [],
    };
    expect(status.countUsage).toBe(0.85);
  });

  it('ReviewOptions accepts expiryLookaheadDays', () => {
    const options: ReviewOptions = { expiryLookaheadDays: 14 };
    expect(options.expiryLookaheadDays).toBe(14);
  });

  it('ReviewResult has expected shape', () => {
    const result: ReviewResult = {
      stale: [],
      expiringSoon: [],
      capacity: {
        countUsage: 0,
        tokenUsage: 0,
        categories: {},
        warnings: [],
      },
      compactionCandidates: [],
    };
    expect(result.stale).toHaveLength(0);
  });

  it('CompactionGroup has expected shape', () => {
    const group: CompactionGroup = {
      keyPrefix: 'product/v2',
      category: 'product',
      edicts: [],
    };
    expect(group.keyPrefix).toBe('product/v2');
  });
});
