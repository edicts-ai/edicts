import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';
import { EdictBudgetExceededError, EdictValidationError } from '../src/errors.js';

let tempDirs: string[] = [];

async function makeStore(name: string, options: ConstructorParameters<typeof EdictStore>[0] = {}) {
  const dir = await mkdtemp(join(tmpdir(), `edicts-extra-${name}-`));
  tempDirs.push(dir);
  return new EdictStore({
    path: join(dir, 'edicts.yaml'),
    autoSave: false,
    ...options,
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe('additional validation coverage', () => {
  it('categories() returns unique sorted normalized categories', async () => {
    const store = await makeStore('categories');
    await store.load();

    await store.add({ text: 'One', category: 'Products' });
    await store.add({ text: 'Two', category: ' team ' });
    await store.add({ text: 'Three', category: 'product' });

    expect(store.categories()).toEqual(['product', 'team']);
  });

  it('find supports predicate functions', async () => {
    const store = await makeStore('predicate-find');
    await store.load();

    await store.add({ text: 'Alpha', category: 'team', confidence: 'verified' });
    await store.add({ text: 'Beta', category: 'product', confidence: 'user' });

    const result = await store.find((edict) => edict.confidence === 'verified');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Alpha');
  });

  it('render() uses custom renderer when no format override is passed', async () => {
    const store = await makeStore('custom-render', {
      renderer: (edicts) => `custom:${edicts.map((e) => e.id).join(',')}`,
    });
    await store.load();
    await store.add({ text: 'Rendered', category: 'test' });

    await expect(store.render()).resolves.toBe('custom:e_001');
    await expect(store.render('plain')).resolves.toContain('Rendered');
  });

  it('render(json) strips internal _tokens and persists lastAccessed when autoSave is enabled', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'edicts-extra-render-save-'));
    tempDirs.push(dir);
    const path = join(dir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: true });
    await store.load();
    await store.add({ text: 'Persist me', category: 'test' });

    const json = await store.render('json');
    const parsed = JSON.parse(json);
    expect(parsed[0]).not.toHaveProperty('_tokens');

    const saved = await readFile(path, 'utf-8');
    expect(saved).toContain('lastAccessed:');
    expect(saved).not.toContain('_tokens');
  });

  it('ephemeral ttl without explicit expiry gets default expiration', async () => {
    const store = await makeStore('ephemeral-default', { defaultEphemeralTtlSeconds: 30 });
    await store.load();

    const before = Date.now();
    const result = await store.add({ text: 'Short lived', category: 'test', ttl: 'ephemeral' });
    const after = Date.now();
    const expiresAt = new Date(result.edict!.expiresAt!).getTime();

    expect(expiresAt).toBeGreaterThanOrEqual(before + 29_000);
    expect(expiresAt).toBeLessThanOrEqual(after + 31_000);
  });

  it('importData prunes expired entries and records validation warnings', async () => {
    const store = await makeStore('import-prune');
    await store.load();

    const result = await store.importData({
      version: 1,
      config: { maxEdicts: 200, tokenBudget: 4000, categories: [] },
      edicts: [
        {
          id: 'expired-import',
          text: 'Expired',
          category: 'test',
          tags: [],
          confidence: 'user',
          source: '',
          ttl: 'event',
          expiresAt: '2020-01-01T00:00:00Z',
          updated: '2020-01-01T00:00:00Z',
        } as any,
      ],
      history: [],
    });

    expect(result.pruned).toBe(1);
    expect(await store.all()).toHaveLength(0);
    expect(store.history().some((entry) => entry.id.startsWith('expired-import'))).toBe(true);
    expect(store.loadWarnings).toContain('Edict expired-import missing created timestamp');
  });

  it('load surfaces malformed YAML as a validation-style failure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'edicts-extra-malformed-'));
    tempDirs.push(dir);
    const path = join(dir, 'edicts.yaml');
    await writeFile(path, 'version: 1\nedicts: [unterminated\n', 'utf-8');

    const store = new EdictStore({ path, autoSave: false });
    await expect(store.load()).rejects.toThrow();
  });

  it('save strips _tokens from serialized output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'edicts-extra-save-'));
    tempDirs.push(dir);
    const path = join(dir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'No internals on disk', category: 'test' });
    await store.save();

    const content = await readFile(path, 'utf-8');
    expect(content).not.toContain('_tokens');
  });

  it('supersession rolls back history and active state when replacement exceeds budget', async () => {
    const store = await makeStore('supersede-budget', { tokenBudget: 5 });
    await store.load();

    await store.add({ text: 'tiny', category: 'test', key: 'shared' });
    await expect(
      store.add({ text: 'this replacement is too large', category: 'test', key: 'shared' })
    ).rejects.toBeInstanceOf(EdictBudgetExceededError);

    const current = await store.get('shared');
    expect(current?.text).toBe('tiny');
    expect(store.history()).toHaveLength(0);
  });

  it('exportData and history return clones, not live references', async () => {
    const store = await makeStore('clone-exports');
    await store.load();
    await store.add({ text: 'Clone me', category: 'test', key: 'clone-key' });
    await store.add({ text: 'Updated clone', category: 'test', key: 'clone-key' });

    const exported = store.exportData();
    exported.edicts[0].text = 'mutated';
    exported.history[0].text = 'mutated history';

    const history = store.history();
    history[0].text = 'mutated copy';

    expect((await store.get('clone-key'))?.text).toBe('Updated clone');
    expect(store.history()[0].text).toBe('Clone me');
  });
});
