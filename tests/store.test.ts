import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';
import { EdictBudgetExceededError, EdictCountLimitError, EdictConflictError } from '../src/errors.js';

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
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Test edict', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    expect(await store2.all()).toHaveLength(1);
    expect(await store2.all()[0].text).toBe('Test edict');
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
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    expect(await store.all()).toHaveLength(1);
    expect(await store.get('existing')?.text).toBe('Pre-existing edict');
  });

  it('uses JSON format when extension is .json', async () => {
    const path = join(tempDir, 'edicts.json');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'JSON edict', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path, autoSave: false });
    await store2.load();
    expect(await store2.all()).toHaveLength(1);
  });

  it('get returns a clone and does not expose internal mutable state', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    await store.add({ text: 'Original text', category: 'test', tags: ['one'] });

    const edict = await store.get('e_001');
    expect(edict?.text).toBe('Original text');

    if (!edict) {
      throw new Error('Expected edict to exist');
    }

    edict.text = 'Mutated outside store';
    edict.tags.push('two');

    const reread = await store.get('e_001');
    expect(reread?.text).toBe('Original text');
    expect(reread?.tags).toEqual(['one']);
  });

  it('update is atomic when category validation fails after a text patch', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, categories: ['product'], autoSave: false });
    await store.load();

    await store.add({ text: 'Original text', category: 'product', tags: ['stable'] });

    expect(() =>
      await store.update('e_001', {
        text: 'New text',
        category: 'invalid-category',
        tags: ['changed'],
      })
    ).toThrow('Unknown category');

    const edict = await store.get('e_001');
    expect(edict).toMatchObject({
      text: 'Original text',
      category: 'product',
      tags: ['stable'],
    });
  });

  it('dirty flag tracks unsaved changes', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    expect(store.dirty).toBe(false);
    await store.add({ text: 'New edict', category: 'test' });
    expect(store.dirty).toBe(true);
    await store.save();
    expect(store.dirty).toBe(false);
  });

  it('respects format override regardless of extension', async () => {
    const path = join(tempDir, 'edicts.txt');
    const store = new EdictStore({ path, format: 'json', autoSave: false });
    await store.load();
    await store.add({ text: 'Test', category: 'test' });
    await store.save();

    const store2 = new EdictStore({ path, format: 'json', autoSave: false });
    await store2.load();
    expect(await store2.all()).toHaveLength(1);
  });

  it('exposes schema validation warnings after load', async () => {
    const path = join(tempDir, 'edicts.yaml');
    await writeFile(path, `
version: 1
edicts:
  - text: "Warning edict"
    category: test
    tags: []
    confidence: user
    source: manual
    ttl: durable
    updated: "2026-03-20T06:00:00Z"
`);

    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    expect(store.loadWarnings).toContain('Missing config section, using defaults');
    expect(store.loadWarnings).toContain('Missing history array, initializing empty');
    expect(store.loadWarnings).toContain('Edict missing id, will be regenerated');
  });


  it('regenerates missing IDs during load', async () => {
    const path = join(tempDir, 'edicts.yaml');
    await writeFile(path, `
version: 1
config:
  maxEdicts: 200
  tokenBudget: 4000
  categories: []
edicts:
  - text: "Missing id"
    category: test
    tags: []
    confidence: user
    source: manual
    ttl: durable
    created: "2026-03-20T06:00:00Z"
    updated: "2026-03-20T06:00:00Z"
history: []
`);

    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    expect(await store.all()).toHaveLength(1);
    expect(await store.all()[0].id).toBe('e_001');
    expect(store.has('e_001')).toBe(true);
  });

  it('throws on save before load when file already exists', async () => {
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

    const store = new EdictStore({ path, autoSave: false });
    await store.add({ text: 'New edict', category: 'test' });

    await expect(store.save()).rejects.toBeInstanceOf(EdictConflictError);

    const reloaded = new EdictStore({ path, autoSave: false });
    await reloaded.load();
    expect(reloaded.all()).toHaveLength(1);
    expect(reloaded.all()[0].id).toBe('existing');
  });

  it('persists file config values loaded from disk', async () => {
    const path = join(tempDir, 'edicts.yaml');
    await writeFile(path, `
version: 1
config:
  maxEdicts: 7
  tokenBudget: 123
  categories:
    - alpha
    - beta
edicts: []
history: []
`);

    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Persist config', category: 'alpha' });
    await store.save();

    const raw = await (await import('node:fs/promises')).readFile(path, 'utf8');
    expect(raw).toContain('maxEdicts: 7');
    expect(raw).toContain('tokenBudget: 123');
    expect(raw).toContain('- alpha');
    expect(raw).toContain('- beta');
  });
});

describe('EdictStore mutations', () => {
  it('add creates edict with defaults', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    const result = await store.add({ text: 'New fact', category: 'Test' });
    const edict = result.edict;
    expect(result.action).toBe('created');
    expect(edict?.id).toBe('e_001');
    expect(edict?.category).toBe('test');
    expect(edict?.confidence).toBe('user');
    expect(edict?.ttl).toBe('durable');
    expect(edict?.tags).toEqual([]);
    expect(edict?._tokens).toBeGreaterThan(0);
  });

  it('add with key uses key as ID', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    const result = await store.add({
      text: 'Product launch',
      category: 'product',
      key: 'product-v2-status',
    });
    expect(result.edict?.id).toBe('product-v2-status');
  });

  it('sequential IDs increment correctly', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();

    const e1 = await store.add({ text: 'First', category: 'test' });
    const e2 = await store.add({ text: 'Second', category: 'test' });
    const e3 = await store.add({ text: 'Third', category: 'test' });
    expect(e1.edict?.id).toBe('e_001');
    expect(e2.edict?.id).toBe('e_002');
    expect(e3.edict?.id).toBe('e_003');
  });

  it('remove returns true for existing edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'To remove', category: 'test' });
    expect(await store.remove('e_001')).toMatchObject({ action: 'deleted', found: true });
    expect(await store.all()).toHaveLength(0);
  });

  it('remove returns false for nonexistent edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    expect(await store.remove('nonexistent')).toMatchObject({ action: 'not_found', found: false, id: 'nonexistent' });
  });

  it('update modifies edict fields', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Original', category: 'test' });
    const updated = await store.update('e_001', { text: 'Updated text', category: 'Product' });
    expect(updated.action).toBe('updated');
    expect(updated.edict?.text).toBe('Updated text');
    expect(updated.edict?.category).toBe('product');
  });

  it('update throws for nonexistent edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    expect(() => await store.update('nope', { text: 'Fail' })).toThrow('nope');
  });

  it('rejects invalid input on add', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    expect(() => await store.add({ text: '', category: 'test' })).toThrow('text');
  });

  it('enforces category allowlist', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, categories: ['product', 'team'] });
    await store.load();
    expect(() => await store.add({ text: 'Hello', category: 'random' })).toThrow('random');
    expect(() => await store.add({ text: 'Hello', category: 'Product' })).not.toThrow();
  });
});

describe('EdictStore reads', () => {
  it('get returns edict, updates lastAccessed, and marks store dirty', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Test', category: 'test', key: 'my-key' });
    await store.save();

    const edict = await store.get('my-key');
    expect(edict?.text).toBe('Test');
    expect(edict?.lastAccessed).toBeDefined();
    expect(store.dirty).toBe(true);
  });

  it('has returns correct boolean', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Test', category: 'test' });
    expect(store.has('e_001')).toBe(true);
    expect(store.has('nope')).toBe(false);
  });

  it('find with predicate works', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Product fact', category: 'product' });
    await store.add({ text: 'Team fact', category: 'team' });
    await store.add({ text: 'Another product', category: 'product' });

    const products = store.find((e) => e.category === 'product');
    expect(products).toHaveLength(2);
  });


  it('all returns cloned edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Original', category: 'test' });

    const edicts = await store.all();
    edicts[0].text = 'Mutated externally';

    expect(await store.get('e_001')?.text).toBe('Original');
  });

  it('find returns cloned edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Product fact', category: 'product' });

    const products = store.find((e) => e.category === 'product');
    products[0].text = 'Mutated externally';

    expect(await store.get('e_001')?.text).toBe('Product fact');
  });

  it('categories returns sorted unique categories', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'A', category: 'team' });
    await store.add({ text: 'B', category: 'product' });
    await store.add({ text: 'C', category: 'team' });
    expect(store.categories()).toEqual(['product', 'team']);
  });
});

describe('EdictStore budget', () => {
  it('tracks token count', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 1000 });
    await store.load();
    await store.add({ text: 'Hello world', category: 'test' });
    expect(store.tokenCount()).toBeGreaterThan(0);
    expect(store.tokenBudgetRemaining()).toBeLessThan(1000);
  });

  it('throws when token budget exceeded', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 5 });
    await store.load();

    let error: unknown;
    try {
      await store.add({ text: 'a'.repeat(100), category: 'test' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(EdictBudgetExceededError);
    expect((error as EdictBudgetExceededError).budget).toBe(5);
  });

  it('throws a distinct error when max edict count is exceeded', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, maxEdicts: 1 });
    await store.load();
    await store.add({ text: 'First', category: 'test' });

    let error: unknown;
    try {
      await store.add({ text: 'Second', category: 'test' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(EdictCountLimitError);
    expect((error as EdictCountLimitError).limit).toBe(1);
    expect((error as EdictCountLimitError).current).toBe(1);
    expect((error as Error).message).toContain('count limit');
  });

  it('uses custom tokenizer', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      tokenBudget: 100,
      tokenizer: (text) => text.length,
    });
    await store.load();
    await store.add({ text: 'hello', category: 'test' });
    expect(store.tokenCount()).toBe(5);
  });

  it('isOverBudget returns correct value', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 1000 });
    await store.load();
    expect(store.isOverBudget()).toBe(false);
  });

  it('throws when update would exceed token budget', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      tokenBudget: 10,
      tokenizer: (text) => text.length,
    });
    await store.load();
    await store.add({ text: 'small', category: 'test' });

    expect(() =>
      await store.update('e_001', { text: 'this update is too large' })
    ).toThrow('budget');
    expect(await store.get('e_001')?.text).toBe('small');
  });

  it('throws when superseding would exceed token budget', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      tokenBudget: 10,
      tokenizer: (text) => text.length,
    });
    await store.load();
    await store.add({ text: 'small', category: 'test', key: 'shared-key' });

    expect(() =>
      await store.add({
        text: 'this superseding text is too large',
        category: 'test',
        key: 'shared-key',
      })
    ).toThrow('budget');
    expect(await store.get('shared-key')?.text).toBe('small');
    expect(store.history()).toHaveLength(0);
  });
});

describe('EdictStore rendering', () => {
  it('render plain returns formatted text', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Test fact', category: 'product', confidence: 'verified' });
    const output = await store.render('plain');
    expect(output).toContain('Test fact');
    expect(output).toContain('verified');
  });

  it('render markdown groups by category', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Fact A', category: 'product' });
    await store.add({ text: 'Fact B', category: 'team' });
    const output = await store.render('markdown');
    expect(output).toContain('## product');
    expect(output).toContain('## team');
  });

  it('render json returns valid JSON and marks store dirty after access updates', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: false });
    await store.load();
    await store.add({ text: 'Test', category: 'test' });
    await store.save();

    const output = await store.render('json');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(store.dirty).toBe(true);
  });

  it('custom renderer is used when no format specified', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      renderer: (edicts) => edicts.map((e) => `CUSTOM: ${e.text}`).join('|'),
    });
    await store.load();
    await store.add({ text: 'Hello', category: 'test' });
    const output = await store.render();
    expect(output).toBe('CUSTOM: Hello');
  });

  it('explicit format overrides custom renderer', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      renderer: () => 'CUSTOM',
    });
    await store.load();
    await store.add({ text: 'Hello', category: 'test' });
    const output = await store.render('plain');
    expect(output).toContain('Hello');
    expect(output).not.toBe('CUSTOM');
  });
});
