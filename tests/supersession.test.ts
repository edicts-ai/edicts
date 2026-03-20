import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-supersede-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Supersession', () => {
  it('adding with same key supersedes existing edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({
      text: 'Product v2 estimated Q2 2026',
      category: 'product',
      key: 'product-v2-status',
    });

    await store.add({
      text: 'Product v2 launches April 15, 2026',
      category: 'product',
      key: 'product-v2-status',
    });

    expect(await store.all()).toHaveLength(1);
    expect((await store.all())[0].text).toBe('Product v2 launches April 15, 2026');
    expect((await store.all())[0].id).toBe('product-v2-status');
  });

  it('superseded edict moves to history', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({ text: 'Original text', category: 'product', key: 'my-key' });
    await store.add({ text: 'Updated text', category: 'product', key: 'my-key' });

    const hist = await store.history();
    expect(hist).toHaveLength(1);
    expect(hist[0].text).toBe('Original text');
    expect(hist[0].supersededBy).toBe('my-key');
  });

  it('multiple supersessions build up history', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({ text: 'Version 1', category: 'product', key: 'status' });
    await store.add({ text: 'Version 2', category: 'product', key: 'status' });
    await store.add({ text: 'Version 3', category: 'product', key: 'status' });

    expect(await store.all()).toHaveLength(1);
    expect((await store.all())[0].text).toBe('Version 3');
    expect(await store.history()).toHaveLength(2);
  });

  it('history IDs stay unique across multiple supersessions of the same key', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({ text: 'Version 1', category: 'product', key: 'status' });
    await store.add({ text: 'Version 2', category: 'product', key: 'status' });
    await store.add({ text: 'Version 3', category: 'product', key: 'status' });

    const historyIds = (await store.history()).map((entry) => entry.id);
    expect(new Set(historyIds).size).toBe(historyIds.length);
  });

  it('supersession persists through save/load', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({ text: 'Original', category: 'product', key: 'k1' });
    await store.add({ text: 'Updated', category: 'product', key: 'k1' });
    await store.save();

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    expect(await store2.all()).toHaveLength(1);
    expect((await store2.all())[0].text).toBe('Updated');
    expect(await store2.history()).toHaveLength(1);
    expect((await store2.history())[0].text).toBe('Original');
  });

  it('adding without key does not trigger supersession', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({ text: 'First', category: 'test' });
    await store.add({ text: 'Second', category: 'test' });

    expect(await store.all()).toHaveLength(2);
    expect(await store.history()).toHaveLength(0);
  });
});
