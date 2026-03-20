import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';
import { EdictConflictError } from '../src/errors.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-concurrency-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Optimistic concurrency', () => {
  it('save succeeds when file unchanged', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Test', category: 'test' });
    await expect(store.save()).resolves.toBeUndefined();
  });

  it('save throws EdictConflictError when file changed externally', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'From store 1', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    await store2.add({ text: 'From store 2', category: 'test' });

    await writeFile(path, 'version: 1\nconfig:\n  maxEdicts: 200\n  tokenBudget: 4000\n  categories: []\nedicts: []\nhistory: []\n');

    await expect(store2.save()).rejects.toThrow(EdictConflictError);
  });

  it('save succeeds on first write (no file existed)', async () => {
    const path = join(tempDir, 'new-edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'First edict ever', category: 'test' });
    await expect(store.save()).resolves.toBeUndefined();
  });

  it('after conflict, reload and retry works', async () => {
    const path = join(tempDir, 'edicts.yaml');

    const store1 = new EdictStore({ path, autoSave: false });
    await store1.load();
    await store1.add({ text: 'Initial', category: 'test' });
    await store1.save();

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    await store2.add({ text: 'Store 2 addition', category: 'test' });

    await store1.add({ text: 'Store 1 second write', category: 'test' });
    await store1.save();

    await expect(store2.save()).rejects.toThrow(EdictConflictError);

    await store2.load();
    await store2.add({ text: 'Store 2 retry', category: 'test' });
    await expect(store2.save()).resolves.toBeUndefined();
  });
});
