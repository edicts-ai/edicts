import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    const result = await store.add({ text: 'Alpha fact', category: 'product' });

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
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({ text: 'First version', category: 'product', key: 'shared' });
    const result = await store.add({ text: 'Second version', category: 'product', key: 'shared' });

    expect(result.action).toBe('superseded');
    expect(result.edict?.text).toBe('Second version');
    expect(await store.history()).toHaveLength(1);
  });

  it('remove returns a structured result for deleted edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    const created = await store.add({ text: 'To remove', category: 'test' });

    const result = await store.remove(created.edict!.id);

    expect(result).toMatchObject({
      action: 'deleted',
      found: true,
      edict: { id: created.edict!.id, text: 'To remove' },
    });
  });

  it('remove returns a structured result for missing edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    const result = await store.remove('missing');

    expect(result).toEqual({
      action: 'not_found',
      found: false,
      id: 'missing',
      pruned: 0,
    });
  });

  it('update returns a structured result for updated edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    const created = await store.add({ text: 'Original', category: 'test' });

    const result = await store.update(created.edict!.id, { text: 'Updated' });

    expect(result).toMatchObject({
      action: 'updated',
      edict: { id: created.edict!.id, text: 'Updated' },
      pruned: 0,
    });
  });

  it('find supports object filters by category, tag, key, confidence, ttl, and text query', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Launch checklist', category: 'Product', tags: ['Launch'], key: 'launch', confidence: 'verified', ttl: 'durable' });
    await store.add({ text: 'Team standup', category: 'Team', tags: ['Internal'], confidence: 'user', ttl: 'event' });

    expect(await store.find({ category: 'products' })).toHaveLength(1);
    expect(await store.find({ tag: 'launches' })).toHaveLength(1);
    expect(await store.find({ key: 'launch' })).toHaveLength(1);
    expect(await store.find({ confidence: 'verified' })).toHaveLength(1);
    expect(await store.find({ ttl: 'event' })).toHaveLength(1);
    expect(await store.find({ text: 'checklist' })).toHaveLength(1);
  });

  it('search finds text across text, category, tags, source, and key', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Casper launch plan', category: 'product', tags: ['roadmap'], source: 'pm-notes', key: 'launch-plan' });
    await store.add({ text: 'Engineering sync', category: 'team', tags: ['internal'], source: 'calendar' });

    expect(await store.search('casper')).toHaveLength(1);
    expect(await store.search('roadmap')).toHaveLength(1);
    expect(await store.search('pm-notes')).toHaveLength(1);
    expect(await store.search('launch-plan')).toHaveLength(1);
    expect(await store.search('team')).toHaveLength(1);
  });

  it('stats returns totals and grouped counts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'A', category: 'product', tags: ['launch'], confidence: 'verified' });
    await store.add({ text: 'B', category: 'team', tags: ['internal'], confidence: 'user', ttl: 'event' });

    expect(await store.stats()).toMatchObject({
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
    const storeA = new EdictStore({ path: pathA, autoSave: false });
    await storeA.load();
    await storeA.add({ text: 'Export me', category: 'product' });

    const exported = storeA.exportData();
    expect(exported.edicts[0]).not.toHaveProperty('_tokens');

    const pathB = join(tempDir, 'edicts-b.yaml');
    const storeB = new EdictStore({ path: pathB, autoSave: false });
    await storeB.load();
    const result = await storeB.importData(exported);

    expect(result).toMatchObject({ imported: 1, historyImported: 0, pruned: 0 });
    expect(await storeB.all()).toHaveLength(1);
    expect((await storeB.get('e_001'))?.text).toBe('Export me');
  });

  it('auto-prunes expired edicts on mutation and reports prune count', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await store.add({ text: 'Old event', category: 'team', ttl: 'event', expiresAt: yesterday });

    const result = await store.add({ text: 'Fresh fact', category: 'team' });

    expect(result.pruned).toBe(1);
    expect((await store.all()).map((e) => e.text)).toEqual(['Fresh fact']);
    expect(await store.history()).toHaveLength(1);
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

  it('get returns JSON for an existing id', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const added = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'CLI fact', '--category', 'product'], { cwd: process.cwd() });
    const edict = JSON.parse(added.stdout);

    const result = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'get', edict.edict.id], { cwd: process.cwd() });

    expect(JSON.parse(result.stdout)).toMatchObject({ id: edict.edict.id, text: 'CLI fact', category: 'product' });
  });

  it('get returns plain output with --plain', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const added = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Plain fact', '--category', 'product'], { cwd: process.cwd() });
    const edict = JSON.parse(added.stdout);

    const result = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'get', edict.edict.id, '--plain'], { cwd: process.cwd() });

    expect(result.stdout).toContain('Plain fact');
    expect(result.stdout).toContain('product');
  });

  it('get on nonexistent id exits 1 with stderr message', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');

    await expect(execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'get', 'missing'], { cwd: process.cwd() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Edict not found'),
    });
  });

  it('remove deletes an edict and confirms what was removed', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const added = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Remove me', '--category', 'product'], { cwd: process.cwd() });
    const edict = JSON.parse(added.stdout);

    const removed = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'remove', edict.edict.id], { cwd: process.cwd() });
    expect(removed.stdout).toContain('Remove me');

    const list = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'list', '--json'], { cwd: process.cwd() });
    expect(JSON.parse(list.stdout)).toEqual([]);
  });

  it('remove on nonexistent id exits 1', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');

    await expect(execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'remove', 'missing'], { cwd: process.cwd() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Edict not found'),
    });
  });

  it('update partially updates fields and preserves unspecified ones', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const added = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Original', '--category', 'Product', '--tags', 'one,two', '--source', 'seed'], { cwd: process.cwd() });
    const edict = JSON.parse(added.stdout).edict;

    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'update', edict.id, '--text', 'Updated'], { cwd: process.cwd() });
    const fetched = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'get', edict.id], { cwd: process.cwd() });

    expect(JSON.parse(fetched.stdout)).toMatchObject({
      id: edict.id,
      text: 'Updated',
      category: 'product',
      tags: ['one', 'two'],
      source: 'seed',
    });
  });

  it('update on nonexistent id exits 1', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');

    await expect(execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'update', 'missing', '--text', 'Updated'], { cwd: process.cwd() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Edict not found'),
    });
  });

  it('search finds matching edicts', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Casper launch plan', '--category', 'product', '--tags', 'roadmap'], { cwd: process.cwd() });
    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Team sync', '--category', 'team'], { cwd: process.cwd() });

    const result = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'search', 'casper'], { cwd: process.cwd() });
    expect(result.stdout).toContain('Casper launch plan');
    expect(result.stdout).not.toContain('Team sync');
  });

  it('search with no matches returns empty output in plain mode', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Something else', '--category', 'team'], { cwd: process.cwd() });

    const result = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'search', 'nomatch'], { cwd: process.cwd() });
    expect(result.stdout).toBe('');
  });

  it('review returns stale, expired, and compaction candidates', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    await store.add({ text: 'Stale durable', category: 'product', key: 'dup/a', ttl: 'durable' });
    await store.add({ text: 'Dup durable', category: 'product', key: 'dup/b', ttl: 'durable' });
    await store.add({ text: 'Expired event', category: 'ops', ttl: 'event', expiresAt: new Date(Date.now() - 60_000).toISOString() });

    const result = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'review', '--stale-days', '0', '--json'], { cwd: process.cwd() });
    const review = JSON.parse(result.stdout);

    expect(review.stale.length).toBeGreaterThan(0);
    expect(review.expired.length).toBeGreaterThan(0);
    expect(review.compactionCandidates.length).toBeGreaterThan(0);
  });

  it('export writes YAML to a file', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const output = join(tempDir, 'export.yaml');
    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Exported fact', '--category', 'product'], { cwd: process.cwd() });

    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'export', '--output', output], { cwd: process.cwd() });

    const content = await readFile(output, 'utf8');
    expect(content).toContain('Exported fact');
    expect(content).toContain('version: 1');
  });

  it('import restores exported edicts', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const exported = join(tempDir, 'export.yaml');
    const replacement = join(tempDir, 'replacement.yaml');

    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'Roundtrip fact', '--category', 'product'], { cwd: process.cwd() });
    await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'export', '--output', exported], { cwd: process.cwd() });

    await execFile('npx', ['tsx', 'src/cli.ts', '--path', replacement, 'import', exported], { cwd: process.cwd() });
    const list = await execFile('npx', ['tsx', 'src/cli.ts', '--path', replacement, 'list', '--json'], { cwd: process.cwd() });

    expect(JSON.parse(list.stdout)).toMatchObject([
      expect.objectContaining({ text: 'Roundtrip fact', category: 'product' }),
    ]);
  });

  it('add without required flags exits 1 with a usage hint', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');

    await expect(execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--category', 'product'], { cwd: process.cwd() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('add requires'),
    });
  });

  it('unknown command prints usage', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');
    const result = await execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'wat'], { cwd: process.cwd() });

    expect(result.stdout).toContain('Usage: edicts');
  });

  it('invalid --format value exits 1', async () => {
    const path = join(tempDir, 'cli-edicts.yaml');

    await expect(execFile('npx', ['tsx', 'src/cli.ts', '--path', path, '--format', 'toml', 'list'], { cwd: process.cwd() })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Invalid format'),
    });
  });

  it('nonexistent parent dir in --path exits 1', async () => {
    const path = join(tempDir, 'missing-dir', 'cli-edicts.yaml');

    await expect(execFile('npx', ['tsx', 'src/cli.ts', '--path', path, 'add', '--text', 'oops', '--category', 'product'], { cwd: process.cwd() })).rejects.toMatchObject({
      code: 1,
    });
  });
});
