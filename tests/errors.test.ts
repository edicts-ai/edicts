import { describe, it, expect } from 'vitest';
import {
  EdictBudgetExceededError,
  EdictConflictError,
  EdictCategoryError,
  EdictValidationError,
  EdictNotFoundError,
} from '../src/errors.js';

describe('Error classes', () => {
  it('EdictBudgetExceededError includes budget info', () => {
    const err = new EdictBudgetExceededError(4000, 4200);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictBudgetExceededError');
    expect(err.budget).toBe(4000);
    expect(err.current).toBe(4200);
    expect(err.message).toContain('4000');
  });

  it('EdictConflictError includes both versions', () => {
    const err = new EdictConflictError('hash1', 'hash2');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictConflictError');
    expect(err.expectedHash).toBe('hash1');
    expect(err.actualHash).toBe('hash2');
  });

  it('EdictCategoryError lists valid categories', () => {
    const err = new EdictCategoryError('dogs', ['product', 'team', 'infra']);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictCategoryError');
    expect(err.category).toBe('dogs');
    expect(err.validCategories).toEqual(['product', 'team', 'infra']);
    expect(err.message).toContain('dogs');
    expect(err.message).toContain('product');
  });

  it('EdictValidationError includes details', () => {
    const err = new EdictValidationError('Missing required field: text');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictValidationError');
  });

  it('EdictNotFoundError includes the ID', () => {
    const err = new EdictNotFoundError('f_999');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EdictNotFoundError');
    expect(err.edictId).toBe('f_999');
    expect(err.message).toContain('f_999');
  });
});
