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
    const store = new EdictStore({ path });
    await store.load();

    store.add({
      text: 'Product v2 estimated Q2 2026',
      category: 'product',
      key: 'product-v2-status',
    });

    store.add({
      text: 'Product v2 launches April 15, 2026',
      category: 'product',
      key: 'product-v2-status',
    });

    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].text).toBe('Product v2 launches April 15, 2026');
    expect(store.all()[0].id).toBe('product-v2-status');
  });

  it('superseded edict moves to history', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'Original text', category: 'product', key: 'my-key' });
    store.add({ text: 'Updated text', category: 'product', key: 'my-key' });

    const hist = store.history();
    expect(hist).toHaveLength(1);
    expect(hist[0].text).toBe('Original text');
    expect(hist[0].supersededBy).toBe('my-key');
  });

  it('multiple supersessions build up history', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'Version 1', category: 'product', key: 'status' });
    store.add({ text: 'Version 2', category: 'product', key: 'status' });
    store.add({ text: 'Version 3', category: 'product', key: 'status' });

    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].text).toBe('Version 3');
    expect(store.history()).toHaveLength(2);
  });

  it('supersession persists through save/load', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'Original', category: 'product', key: 'k1' });
    store.add({ text: 'Updated', category: 'product', key: 'k1' });
    await store.save();

    const store2 = new EdictStore({ path });
    await store2.load();
    expect(store2.all()).toHaveLength(1);
    expect(store2.all()[0].text).toBe('Updated');
    expect(store2.history()).toHaveLength(1);
    expect(store2.history()[0].text).toBe('Original');
  });

  it('adding without key does not trigger supersession', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'First', category: 'test' });
    store.add({ text: 'Second', category: 'test' });

    expect(store.all()).toHaveLength(2);
    expect(store.history()).toHaveLength(0);
  });
});
