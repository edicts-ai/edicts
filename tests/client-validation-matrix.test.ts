import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';

const matrixPath = new URL('../docs/integrations/client-validation-matrix.md', import.meta.url);
const scriptPath = new URL('../scripts/validate-client-tutorials.mjs', import.meta.url);

describe('client tutorial validation artifacts', () => {
  test('validation matrix covers Claude Code, Codex CLI, and Cursor', async () => {
    const matrix = await readFile(matrixPath, 'utf8');

    expect(matrix).toContain('Claude Code');
    expect(matrix).toContain('Codex CLI');
    expect(matrix).toContain('Cursor');
    expect(matrix).toContain('Smoke test command');
    expect(matrix).toContain('Publication gate');
  });

  test('repeatable validator encodes the required client scenarios', async () => {
    const script = await readFile(scriptPath, 'utf8');

    expect(script).toContain('claude-code');
    expect(script).toContain('codex-cli');
    expect(script).toContain('cursor');
    expect(script).toContain('edicts init');
    expect(script).toContain('edicts update');
    expect(script).toContain('edicts list');
  });
});
