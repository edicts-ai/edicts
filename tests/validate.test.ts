import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-validate-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const VALID_YAML = `version: 1
config:
  maxEdicts: 200
  tokenBudget: 4000
  categories: []
edicts:
  - id: e_001
    text: "Prefer concise responses"
    category: general
    confidence: verified
    ttl: durable
    created: "2024-01-01T00:00:00.000Z"
    updated: "2024-01-01T00:00:00.000Z"
history: []
`;

const INVALID_YAML = `version: 1
config:
  maxEdicts: 200
edicts:
  - id: e_001
    text: ""
    category: general
    confidence: verified
    ttl: durable
    created: "2024-01-01T00:00:00.000Z"
    updated: "2024-01-01T00:00:00.000Z"
history: []
`;

describe('edicts validate command', () => {
  it('exits 0 and prints success for a valid edicts file', async () => {
    const path = join(tempDir, 'edicts.yaml');
    await writeFile(path, VALID_YAML, 'utf8');

    const result = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'validate'], {
      cwd: process.cwd(),
    });

    expect(result.stdout).toContain('All edicts valid');
    expect(result.stdout).toContain('1 edicts');
  });

  it('exits 1 and reports errors for an invalid edicts file', async () => {
    const path = join(tempDir, 'edicts_invalid.yaml');
    await writeFile(path, INVALID_YAML, 'utf8');

    await expect(
      execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'validate'], { cwd: process.cwd() }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Edict text is required'),
    });
  });

  it('exits 1 with a clear message when no edicts file is found', async () => {
    await expect(
      execFile('npx', ['tsx', 'src/cli.ts', '--path', join(tempDir, 'nonexistent.yaml'), 'validate'], {
        cwd: process.cwd(),
      }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Cannot read file'),
    });
  });
});
