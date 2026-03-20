import { describe, it, expect } from 'vitest';
import { parseDuration } from '../src/duration.js';

describe('parseDuration', () => {
  it('parses minutes suffix', () => {
    expect(parseDuration('30m')).toBe(1800);
  });

  it('parses hours suffix', () => {
    expect(parseDuration('2h')).toBe(7200);
  });

  it('parses days suffix', () => {
    expect(parseDuration('7d')).toBe(604800);
  });

  it('accepts number directly (seconds)', () => {
    expect(parseDuration(3600)).toBe(3600);
  });

  it('accepts numeric string as seconds', () => {
    expect(parseDuration('86400')).toBe(86400);
  });

  it('accepts string "0" as zero seconds', () => {
    expect(parseDuration('0')).toBe(0);
  });

  it('accepts number 0 as zero seconds', () => {
    expect(parseDuration(0)).toBe(0);
  });

  it('handles whitespace in string', () => {
    expect(parseDuration(' 2h ')).toBe(7200);
  });

  it('rejects invalid suffix', () => {
    expect(() => parseDuration('5w')).toThrow('Invalid duration');
  });

  it('rejects non-numeric strings', () => {
    expect(() => parseDuration('banana')).toThrow('Invalid duration');
  });

  it('rejects negative numbers', () => {
    expect(() => parseDuration(-1)).toThrow('Invalid duration');
  });
});
