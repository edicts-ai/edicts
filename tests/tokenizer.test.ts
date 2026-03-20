import { describe, it, expect } from 'vitest';
import { defaultTokenizer } from '../src/tokenizer.js';

describe('defaultTokenizer', () => {
  it('approximates tokens as chars / 4', () => {
    expect(defaultTokenizer('12345678901234567890')).toBe(5);
  });

  it('rounds up with Math.ceil', () => {
    expect(defaultTokenizer('hello')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(defaultTokenizer('')).toBe(0);
  });

  it('handles multi-line text', () => {
    const text = 'Line one\nLine two\nLine three';
    expect(defaultTokenizer(text)).toBe(Math.ceil(text.length / 4));
  });

  it('handles unicode', () => {
    const text = '日本語テスト';
    expect(defaultTokenizer(text)).toBe(Math.ceil(text.length / 4));
  });
});
