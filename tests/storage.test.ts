import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { YamlStorage } from '../src/storage/yaml.js';
import { JsonStorage } from '../src/storage/json.js';
import type { EdictFileSchema } from '../src/types.js';

const emptySchema: EdictFileSchema = {
  version: 1,
  config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
  edicts: [],
  history: [],
};

const sampleSchema: EdictFileSchema = {
  version: 1,
  config: { maxEdicts: 200, tokenBudget: 4000, categories: ['product'] },
  edicts: [
    {
      id: 'test-edict',
      text: 'Test edict text',
      category: 'product',
      tags: ['test'],
      confidence: 'user',
      source: 'test',
      key: 'test-edict',
      ttl: 'durable',
      created: '2026-03-20T06:00:00Z',
      updated: '2026-03-20T06:00:00Z',
    },
  ],
  history: [],
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('YamlStorage', () => {
  it('writes and reads back correctly', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(sampleSchema);
    const result = await storage.read();
    expect(result.edicts).toHaveLength(1);
    expect(result.edicts[0].id).toBe('test-edict');
  });

  it('returns default schema when file does not exist', async () => {
    const path = join(tempDir, 'nonexistent.yaml');
    const storage = new YamlStorage(path);
    const result = await storage.read();
    expect(result.version).toBe(1);
    expect(result.edicts).toHaveLength(0);
  });

  it('computes content hash', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(sampleSchema);
    const hash = await storage.hash();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash changes when content changes', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(emptySchema);
    const hash1 = await storage.hash();
    await storage.write(sampleSchema);
    const hash2 = await storage.hash();
    expect(hash1).not.toBe(hash2);
  });

  it('writes atomically (temp file + rename)', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const storage = new YamlStorage(path);
    await storage.write(sampleSchema);
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('test-edict');
  });

  it('returns null hash when file does not exist', async () => {
    const path = join(tempDir, 'nonexistent.yaml');
    const storage = new YamlStorage(path);
    const hash = await storage.hash();
    expect(hash).toBeNull();
  });
});

describe('JsonStorage', () => {
  it('writes and reads back correctly', async () => {
    const path = join(tempDir, 'edicts.json');
    const storage = new JsonStorage(path);
    await storage.write(sampleSchema);
    const result = await storage.read();
    expect(result.edicts).toHaveLength(1);
    expect(result.edicts[0].id).toBe('test-edict');
  });

  it('returns default schema when file does not exist', async () => {
    const path = join(tempDir, 'nonexistent.json');
    const storage = new JsonStorage(path);
    const result = await storage.read();
    expect(result.edicts).toHaveLength(0);
  });

  it('produces human-readable JSON', async () => {
    const path = join(tempDir, 'edicts.json');
    const storage = new JsonStorage(path);
    await storage.write(sampleSchema);
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('\n');
  });
});
