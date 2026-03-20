import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EdictStore } from '../src/store.js';
import { EdictBudgetExceededError } from '../src/errors.js';
import type { CompactionGroup, Edict } from '../src/types.js';

let tempDirs: string[] = [];

async function makeStore(name: string, options: ConstructorParameters<typeof EdictStore>[0] = {}) {
  const dir = await mkdtemp(join(tmpdir(), `edicts-lifecycle-${name}-`));
  tempDirs.push(dir);
  return new EdictStore({
    path: join(dir, 'edicts.yaml'),
    autoSave: false,
    ...options,
  });
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe('capacityStatus', () => {
  it('reports usage ratios and category breakdown', async () => {
    const store = await makeStore('capacity', {
      maxEdicts: 10,
      tokenBudget: 100,
      categoryLimits: { product: 1 },
      defaultCategoryLimit: 5,
    });
    await store.load();

    await store.add({ text: 'one two three four', category: 'product' });
    await store.add({ text: 'five six seven eight', category: 'product' });

    const status = store.capacityStatus();
    expect(status.countUsage).toBe(0.2);
    expect(status.tokenUsage).toBeGreaterThan(0);
    expect(status.categories.product.count).toBe(2);
    expect(status.categories.product.limit).toBe(1);
    expect(status.categories.product.overLimit).toBe(true);
    expect(status.warnings.some((w) => w.includes('Category "product"'))).toBe(true);
  });

  it('warns when count or token usage exceeds 80%', async () => {
    const store = await makeStore('capacity-warning', {
      maxEdicts: 5,
      tokenBudget: 12,
    });
    await store.load();

    await store.add({ text: '1234567890', category: 'test' });
    await store.add({ text: '1234567890', category: 'test' });
    await store.add({ text: '1234567890', category: 'test' });
    await store.add({ text: '1234567890', category: 'test' });

    const status = store.capacityStatus();
    expect(status.warnings.some((w) => w.includes('count capacity'))).toBe(true);
    expect(status.warnings.some((w) => w.includes('token capacity'))).toBe(true);
  });
});

describe('mutation warnings', () => {
  it('add returns capacity warnings', async () => {
    const store = await makeStore('add-warning', {
      maxEdicts: 5,
      tokenBudget: 100,
      categoryLimits: { product: 1 },
    });
    await store.load();

    await store.add({ text: 'first', category: 'product' });
    const result = await store.add({ text: 'second', category: 'product' });

    expect(result.warnings?.some((w) => w.includes('Category "product"'))).toBe(true);
  });

  it('update returns capacity warnings', async () => {
    const store = await makeStore('update-warning', {
      maxEdicts: 5,
      tokenBudget: 100,
      categoryLimits: { product: 1 },
    });
    await store.load();

    await store.add({ text: 'first', category: 'ops' });
    await store.add({ text: 'second', category: 'product' });
    const result = await store.update('e_001', { category: 'product' });

    expect(result.warnings?.some((w) => w.includes('Category "product"'))).toBe(true);
  });
});

describe('review', () => {
  it('surfaces stale durable edicts using lastAccessed or created fallback', async () => {
    const store = await makeStore('review-stale', { staleThresholdDays: 30 });
    await store.load();

    await store.add({ text: 'Durable', category: 'test', ttl: 'durable' });
    const internal = (await store.all())[0] as Edict;
    const live = (store as any)._edicts.find((e: Edict) => e.id === internal.id);
    live.created = '2025-01-01T00:00:00Z';
    live.lastAccessed = '2025-01-01T00:00:00Z';

    const result = store.review();
    expect(result.stale).toHaveLength(1);
  });

  it('surfaces expiring soon edicts and compaction candidates', async () => {
    const store = await makeStore('review-expiring');
    await store.load();

    const soon = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    const later = new Date(Date.now() + 20 * 86400 * 1000).toISOString();
    await store.add({ text: 'Soon', category: 'product', ttl: 'event', expiresAt: soon, key: 'product/v2/alpha' });
    await store.add({ text: 'Later', category: 'product', ttl: 'event', expiresAt: later, key: 'product/v2/beta' });

    const result = store.review();
    expect(result.expiringSoon).toHaveLength(1);
    expect(result.compactionCandidates.some((g) => g.keyPrefix === 'product/v2')).toBe(true);
  });
});

describe('compact', () => {
  it('compacts a group into a single merged edict and archives originals', async () => {
    const store = await makeStore('compact');
    await store.load();

    await store.add({ text: 'A', category: 'product', key: 'product/v2/a' });
    await store.add({ text: 'B', category: 'product', key: 'product/v2/b' });

    const group = store.review().compactionCandidates.find((g) => g.keyPrefix === 'product/v2') as CompactionGroup;
    const result = await store.compact(group, {
      text: 'Merged',
      category: 'product',
      key: 'product/v2',
      ttl: 'durable',
    });

    expect(result.action).toBe('created');
    const all = await store.all();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('Merged');
    expect(store.history().filter((h) => h.supersededBy === 'compacted')).toHaveLength(2);
  });

  it('rolls back compaction if merged edict exceeds budget', async () => {
    const store = await makeStore('compact-rollback', { tokenBudget: 2 });
    await store.load();

    await store.add({ text: 'a', category: 'product', key: 'product/v2/a' });
    await store.add({ text: 'b', category: 'product', key: 'product/v2/b' });

    const group = store.review().compactionCandidates[0];

    await expect(
      store.compact(group, { text: 'this is way too long', category: 'product', key: 'product/v2' })
    ).rejects.toBeInstanceOf(EdictBudgetExceededError);

    const all = await store.all();
    expect(all).toHaveLength(2);
    expect(store.history()).toHaveLength(0);
  });
});

describe('auto-save and pruning on reads', () => {
  it('auto-saves add/remove/update by default', async () => {
    const store = await makeStore('autosave-default', { autoSave: true });
    await store.load();

    await store.add({ text: 'Saved', category: 'test' });
    let persisted = await readFile((store as any).storage.path, 'utf8');
    expect(persisted).toContain('Saved');

    await store.update('e_001', { text: 'Updated' });
    persisted = await readFile((store as any).storage.path, 'utf8');
    expect(persisted).toContain('Updated');

    await store.remove('e_001');
    persisted = await readFile((store as any).storage.path, 'utf8');
    expect(persisted).not.toContain('Updated');
  });

  it('does not auto-save when autoSave is false', async () => {
    const store = await makeStore('autosave-off', { autoSave: false });
    await store.load();
    await store.save();

    await store.add({ text: 'Unsaved', category: 'test' });
    const persisted = await readFile((store as any).storage.path, 'utf8');
    expect(persisted).not.toContain('Unsaved');
  });

  it('prunes expired edicts on read methods and auto-saves prune when enabled', async () => {
    const store = await makeStore('read-prune', { autoSave: true });
    await store.load();
    await store.add({ text: 'Active', category: 'test' });

    (store as any)._edicts.push({
      id: 'expired-manual',
      text: 'Expired',
      category: 'test',
      tags: [],
      confidence: 'user',
      source: '',
      ttl: 'event',
      expiresAt: '2020-01-01T00:00:00Z',
      created: '2020-01-01T00:00:00Z',
      updated: '2020-01-01T00:00:00Z',
      _tokens: 2,
    });

    expect((await store.all()).every((e) => e.id !== 'expired-manual')).toBe(true);
    expect(store.history().some((h) => h.id.startsWith('expired-manual'))).toBe(true);

    const store2 = new EdictStore({ path: (store as any).storage.path, autoSave: false });
    await store2.load();
    expect((await store2.all()).every((e) => e.id !== 'expired-manual')).toBe(true);
    expect(store2.history().some((h) => h.id.startsWith('expired-manual'))).toBe(true);
  });
});

describe('expiresIn resolution', () => {
  it('resolves expiresIn and default ephemeral expiry', async () => {
    const store = await makeStore('expires', { defaultEphemeralTtlSeconds: 7200 });
    await store.load();

    const before = Date.now();
    await store.add({ text: 'Temp', category: 'test', ttl: 'ephemeral', expiresIn: '2h' });
    await store.add({ text: 'Implicit', category: 'test', ttl: 'ephemeral' });
    const after = Date.now();

    const all = await store.all();
    const explicit = all.find((e) => e.text === 'Temp');
    const implicit = all.find((e) => e.text === 'Implicit');

    expect(explicit?.expiresAt).toBeDefined();
    expect(implicit?.expiresAt).toBeDefined();
    expect(new Date(explicit!.expiresAt!).getTime()).toBeGreaterThanOrEqual(before + 7200 * 1000 - 1000);
    expect(new Date(implicit!.expiresAt!).getTime()).toBeLessThanOrEqual(after + 7200 * 1000 + 1000);
  });

  it('updates edict with expiresAt using expiresIn patch', async () => {
    const store = await makeStore('expires-update-patch');
    await store.load();

    await store.add({ text: 'Test', category: 'test', expiresAt: '2030-01-01T00:00:00Z' });
    const before = Date.now();
    const result = await store.update('e_001', { expiresIn: '2h' });
    const after = Date.now();

    expect(result.action).toBe('updated');
    expect(result.edict?.expiresAt).toBeDefined();
    expect(result.edict?.expiresAt).not.toBe('2030-01-01T00:00:00Z');

    const expiresMs = new Date(result.edict!.expiresAt!).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 7200 * 1000 - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 7200 * 1000 + 1000);
  });
});
