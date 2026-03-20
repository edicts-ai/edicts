import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { EdictStore } from '../src/store.js';

const execFile = promisify(execFileCb);

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-crud-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('EdictStore CRUD programmatic API', () => {
  it('add returns a structured result for created edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const result = store.add({ text: 'Alpha fact', category: 'product' });

    expect(result).toMatchObject({
      action: 'created',
      pruned: 0,
      edict: {
        id: 'e_001',
        text: 'Alpha fact',
        category: 'product',
      },
    });
  });

  it('add with an existing key returns a structured superseded result', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    store.add({ text: 'First version', category: 'product', key: 'shared' });
    const result = store.add({ text: 'Second version', category: 'product', key: 'shared' });

    expect(result.action).toBe('superseded');
    expect(result.edict.text).toBe('Second version');
    expect(store.history()).toHaveLength(1);
  });

  it('remove returns a structured result for deleted edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    const created = store.add({ text: 'To remove', category: 'test' });

    const result = store.remove(created.edict.id);

    expect(result).toMatchObject({
      action: 'deleted',
      found: true,
      edict: { id: created.edict.id, text: 'To remove' },
    });
  });

  it('remove returns a structured result for missing edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const result = store.remove('missing');

    expect(result).toEqual({
      action: 'not_found',
      found: false,
      id: 'missing',
      pruned: 0,
    });
  });

  it('update returns a structured result for updated edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    const created = store.add({ text: 'Original', category: 'test' });

    const result = store.update(created.edict.id, { text: 'Updated' });

    expect(result).toMatchObject({
      action: 'updated',
      edict: { id: created.edict.id, text: 'Updated' },
      pruned: 0,
    });
  });

  it('find supports object filters by category, tag, key, confidence, ttl, and text query', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Launch checklist', category: 'Product', tags: ['Launch'], key: 'launch', confidence: 'verified', ttl: 'durable' });
    store.add({ text: 'Team standup', category: 'Team', tags: ['Internal'], confidence: 'user', ttl: 'event' });

    expect(store.find({ category: 'products' })).toHaveLength(1);
    expect(store.find({ tag: 'launches' })).toHaveLength(1);
    expect(store.find({ key: 'launch' })).toHaveLength(1);
    expect(store.find({ confidence: 'verified' })).toHaveLength(1);
    expect(store.find({ ttl: 'event' })).toHaveLength(1);
    expect(store.find({ text: 'checklist' })).toHaveLength(1);
  });

  it('search finds text across text, category, tags, source, and key', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Casper launch plan', category: 'product', tags: ['roadmap'], source: 'pm-notes', key: 'launch-plan' });
    store.add({ text: 'Engineering sync', category: 'team', tags: ['internal'], source: 'calendar' });

    expect(store.search('casper')).toHaveLength(1);
    expect(store.search('roadmap')).toHaveLength(1);
    expect(store.search('pm-notes')).toHaveLength(1);
    expect(store.search('launch-plan')).toHaveLength(1);
    expect(store.search('team')).toHaveLength(1);
  });

  it('stats returns totals and grouped counts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'A', category: 'product', tags: ['launch'], confidence: 'verified' });
    store.add({ text: 'B', category: 'team', tags: ['internal'], confidence: 'user', ttl: 'event' });

    expect(store.stats()).toMatchObject({
      total: 2,
      history: 0,
      byCategory: { product: 1, team: 1 },
      byConfidence: { verified: 1, user: 1 },
      byTtl: { durable: 1, event: 1 },
      byTag: { launch: 1, internal: 1 },
    });
  });

  it('exportData strips internal _tokens and importData restores store state', async () => {
    const pathA = join(tempDir, 'edicts-a.yaml');
    const storeA = new EdictStore({ path: pathA });
    await storeA.load();
    storeA.add({ text: 'Export me', category: 'product' });

    const exported = storeA.exportData();
    expect(exported.edicts[0]).not.toHaveProperty('_tokens');

    const pathB = join(tempDir, 'edicts-b.yaml');
    const storeB = new EdictStore({ path: pathB });
    await storeB.load();
    const result = storeB.importData(exported);

    expect(result).toMatchObject({ imported: 1, historyImported: 0, pruned: 0 });
    expect(storeB.all()).toHaveLength(1);
    expect(storeB.get('e_001')?.text).toBe('Export me');
  });

  it('auto-prunes expired edicts on mutation and reports prune count', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    store.add({ text: 'Old event', category: 'team', ttl: 'event', expiresAt: yesterday });

    const result = store.add({ text: 'Fresh fact', category: 'team' });

    expect(result.pruned).toBe(1);
    expect(store.all().map((e) => e.text)).toEqual(['Fresh fact']);
    expect(store.history()).toHaveLength(1);
  });
});

describe('edicts CLI', () => {
  it('supports add/list/stats via standalone CLI', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');

    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'CLI fact', '--category', 'product'], {
      cwd: process.cwd(),
    });

    const list = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'list'], {
      cwd: process.cwd(),
    });
    expect(list.stdout).toContain('CLI fact');

    const stats = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'stats'], {
      cwd: process.cwd(),
    });
    expect(stats.stdout).toContain('"total": 1');
  });
});
