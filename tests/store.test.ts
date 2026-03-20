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

    const store = new EdictStore({ path });
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

    const store = new EdictStore({ path });
    await store.load();

    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].id).toBe('e_001');
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

    const store = new EdictStore({ path });
    store.add({ text: 'New edict', category: 'test' });

    await expect(store.save()).rejects.toBeInstanceOf(EdictConflictError);

    const reloaded = new EdictStore({ path });
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

    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Persist config', category: 'alpha' });
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
    const store = new EdictStore({ path });
    await store.load();

    const edict = store.add({ text: 'New fact', category: 'Test' });
    expect(edict.id).toBe('e_001');
    expect(edict.category).toBe('test');
    expect(edict.confidence).toBe('user');
    expect(edict.ttl).toBe('durable');
    expect(edict.tags).toEqual([]);
    expect(edict._tokens).toBeGreaterThan(0);
  });

  it('add with key uses key as ID', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const edict = store.add({
      text: 'Product launch',
      category: 'product',
      key: 'product-v2-status',
    });
    expect(edict.id).toBe('product-v2-status');
  });

  it('sequential IDs increment correctly', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();

    const e1 = store.add({ text: 'First', category: 'test' });
    const e2 = store.add({ text: 'Second', category: 'test' });
    const e3 = store.add({ text: 'Third', category: 'test' });
    expect(e1.id).toBe('e_001');
    expect(e2.id).toBe('e_002');
    expect(e3.id).toBe('e_003');
  });

  it('remove returns true for existing edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'To remove', category: 'test' });
    expect(store.remove('e_001')).toBe(true);
    expect(store.all()).toHaveLength(0);
  });

  it('remove returns false for nonexistent edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(store.remove('nonexistent')).toBe(false);
  });

  it('update modifies edict fields', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Original', category: 'test' });
    const updated = store.update('e_001', { text: 'Updated text', category: 'Product' });
    expect(updated.text).toBe('Updated text');
    expect(updated.category).toBe('product');
  });

  it('update throws for nonexistent edict', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(() => store.update('nope', { text: 'Fail' })).toThrow('nope');
  });

  it('rejects invalid input on add', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    expect(() => store.add({ text: '', category: 'test' })).toThrow('text');
  });

  it('enforces category allowlist', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, categories: ['product', 'team'] });
    await store.load();
    expect(() => store.add({ text: 'Hello', category: 'random' })).toThrow('random');
    expect(() => store.add({ text: 'Hello', category: 'Product' })).not.toThrow();
  });
});

describe('EdictStore reads', () => {
  it('get returns edict, updates lastAccessed, and marks store dirty', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test', key: 'my-key' });
    await store.save();

    const edict = store.get('my-key');
    expect(edict?.text).toBe('Test');
    expect(edict?.lastAccessed).toBeDefined();
    expect(store.dirty).toBe(true);
  });

  it('has returns correct boolean', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    expect(store.has('e_001')).toBe(true);
    expect(store.has('nope')).toBe(false);
  });

  it('find with predicate works', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Product fact', category: 'product' });
    store.add({ text: 'Team fact', category: 'team' });
    store.add({ text: 'Another product', category: 'product' });

    const products = store.find((e) => e.category === 'product');
    expect(products).toHaveLength(2);
  });


  it('all returns cloned edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Original', category: 'test' });

    const edicts = store.all();
    edicts[0].text = 'Mutated externally';

    expect(store.get('e_001')?.text).toBe('Original');
  });

  it('find returns cloned edicts', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Product fact', category: 'product' });

    const products = store.find((e) => e.category === 'product');
    products[0].text = 'Mutated externally';

    expect(store.get('e_001')?.text).toBe('Product fact');
  });

  it('categories returns sorted unique categories', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'A', category: 'team' });
    store.add({ text: 'B', category: 'product' });
    store.add({ text: 'C', category: 'team' });
    expect(store.categories()).toEqual(['product', 'team']);
  });
});

describe('EdictStore budget', () => {
  it('tracks token count', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 1000 });
    await store.load();
    store.add({ text: 'Hello world', category: 'test' });
    expect(store.tokenCount()).toBeGreaterThan(0);
    expect(store.tokenBudgetRemaining()).toBeLessThan(1000);
  });

  it('throws when token budget exceeded', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, tokenBudget: 5 });
    await store.load();

    let error: unknown;
    try {
      store.add({ text: 'a'.repeat(100), category: 'test' });
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
    store.add({ text: 'First', category: 'test' });

    let error: unknown;
    try {
      store.add({ text: 'Second', category: 'test' });
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
    store.add({ text: 'hello', category: 'test' });
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
    store.add({ text: 'small', category: 'test' });

    expect(() =>
      store.update('e_001', { text: 'this update is too large' })
    ).toThrow('budget');
    expect(store.get('e_001')?.text).toBe('small');
  });

  it('throws when superseding would exceed token budget', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      tokenBudget: 10,
      tokenizer: (text) => text.length,
    });
    await store.load();
    store.add({ text: 'small', category: 'test', key: 'shared-key' });

    expect(() =>
      store.add({
        text: 'this superseding text is too large',
        category: 'test',
        key: 'shared-key',
      })
    ).toThrow('budget');
    expect(store.get('shared-key')?.text).toBe('small');
    expect(store.history()).toHaveLength(0);
  });
});

describe('EdictStore rendering', () => {
  it('render plain returns formatted text', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test fact', category: 'product', confidence: 'verified' });
    const output = store.render('plain');
    expect(output).toContain('Test fact');
    expect(output).toContain('verified');
  });

  it('render markdown groups by category', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Fact A', category: 'product' });
    store.add({ text: 'Fact B', category: 'team' });
    const output = store.render('markdown');
    expect(output).toContain('## product');
    expect(output).toContain('## team');
  });

  it('render json returns valid JSON and marks store dirty after access updates', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path });
    await store.load();
    store.add({ text: 'Test', category: 'test' });
    await store.save();

    const output = store.render('json');
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
    store.add({ text: 'Hello', category: 'test' });
    const output = store.render();
    expect(output).toBe('CUSTOM: Hello');
  });

  it('explicit format overrides custom renderer', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({
      path,
      renderer: () => 'CUSTOM',
    });
    await store.load();
    store.add({ text: 'Hello', category: 'test' });
    const output = store.render('plain');
    expect(output).toContain('Hello');
    expect(output).not.toBe('CUSTOM');
  });
});
