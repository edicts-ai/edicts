import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-store-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('EdictStore lifecycle', () => {
  it('creates a new file on first save', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test edict', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
    expect(store2.all()[0].text).toBe('Test edict');
  });

  it('loads existing YAML file', async () => {
    const path = join(tempDir, 'edicts.yaml');
    await writeFile(path, `
version: 1
config:
  maxEdicts: 200
  tokenBudget: 4000
  categories: []
edicts:
  - id: existing
    text: "Pre-existing edict"
    category: test
    tags: []
    confidence: user
    source: manual
    ttl: durable
    created: "2026-03-20T06:00:00Z"
    updated: "2026-03-20T06:00:00Z"
history: []
`);
    const store = new EdictStore({ path });
    await store.load();
    expect(store.all()).toHaveLength(1);
    expect(store.get('existing')?.text).toBe('Pre-existing edict');
  });

  it('uses JSON format when extension is .json', async () => {
    const path = join(tempDir, 'edicts.json');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'JSON edict', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
  });

  it('dirty flag tracks unsaved changes', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(store.dirty).toBe(false);
    store.add({ text: 'New edict', category: 'test' });
    expect(store.dirty).toBe(true);
    await store.save();
    expect(store.dirty).toBe(false);
  });

  it('respects format override regardless of extension', async () => {
    const path = join(tempDir, 'edicts.txt');
    const store = new EdictStore({ path, format: 'json' });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path, format: 'json' });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
  });
});
