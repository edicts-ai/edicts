import { describe, it, expect } from 'vitest';
import { normalizeCategory, normalizeTags } from '../src/normalize.js';

describe('normalizeCategory', () => {
  it('lowercases', () => {
    expect(normalizeCategory('Product')).toBe('product');
    expect(normalizeCategory('INFRA')).toBe('infra');
  });

  it('trims whitespace', () => {
    expect(normalizeCategory('  product  ')).toBe('product');
  });

  it('strips trailing s for simple plurals', () => {
    expect(normalizeCategory('Dogs')).toBe('dog');
    expect(normalizeCategory('products')).toBe('product');
    expect(normalizeCategory('teams')).toBe('team');
  });

  it('handles es and ies endings without malformed singulars', () => {
    expect(normalizeCategory('addresses')).toBe('address');
    expect(normalizeCategory('branches')).toBe('branch');
    expect(normalizeCategory('patches')).toBe('patch');
    expect(normalizeCategory('fixes')).toBe('fix');
    expect(normalizeCategory('categories')).toBe('category');
    expect(normalizeCategory('buses')).toBe('buses');
    expect(normalizeCategory('features')).toBe('features');
  });

  it('does not strip s from words that end in s naturally', () => {
    expect(normalizeCategory('process')).toBe('process');
    expect(normalizeCategory('status')).toBe('status');
    expect(normalizeCategory('analysis')).toBe('analysis');
    expect(normalizeCategory('business')).toBe('business');
    expect(normalizeCategory('bonus')).toBe('bonus');
    expect(normalizeCategory('campus')).toBe('campus');
  });

  it('does not strip s from short words', () => {
    expect(normalizeCategory('ops')).toBe('ops');
    expect(normalizeCategory('dns')).toBe('dns');
  });

  it('handles combined transformations', () => {
    expect(normalizeCategory('  Dogs  ')).toBe('dog');
    expect(normalizeCategory('PRODUCTS')).toBe('product');
  });
});

describe('normalizeTags', () => {
  it('normalizes each tag', () => {
    expect(normalizeTags(['Launch', '  V2  ', 'Features'])).toEqual([
      'launch', 'v2', 'features',
    ]);
  });

  it('deduplicates after normalization', () => {
    expect(normalizeTags(['Dog', 'dogs', 'DOG'])).toEqual(['dog']);
  });

  it('handles empty array', () => {
    expect(normalizeTags([])).toEqual([]);
  });
});
