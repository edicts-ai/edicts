import type {
  Edict,
  EdictInput,
  EdictStoreOptions,
  HistoryEntry,
  EdictFileSchema,
  Tokenizer,
  Renderer,
} from './types.js';
import { YamlStorage } from './storage/yaml.js';
import { JsonStorage } from './storage/json.js';
import type { Storage } from './storage/base.js';
import { DEFAULT_SCHEMA } from './storage/base.js';
import { defaultTokenizer } from './tokenizer.js';
import { renderPlain, renderMarkdown, renderJson } from './renderer.js';
import { normalizeCategory, normalizeTags } from './normalize.js';
import { validateEdictInput, validateFileSchema, pruneExpired } from './schema.js';
import {
  EdictBudgetExceededError,
  EdictConflictError,
  EdictCategoryError,
  EdictNotFoundError,
} from './errors.js';

export class EdictStore {
  private _edicts: Edict[] = [];
  private _history: HistoryEntry[] = [];
  private _fileConfig: EdictFileSchema['config'];
  private _fileHash: string | null = null;
  private _dirty = false;
  private _loaded = false;
  private _sequentialCounter = 0;

  private readonly storage: Storage;
  private readonly tokenizer: Tokenizer;
  private readonly customRenderer: Renderer | undefined;
  private readonly maxEdicts: number;
  private readonly tokenBudget: number;
  private readonly categoryAllowlist: string[] | undefined;

  constructor(options?: EdictStoreOptions) {
    const opts = options ?? {};
    const path = opts.path ?? './edicts.yaml';
    const format = opts.format ?? (path.endsWith('.json') ? 'json' : 'yaml');
    this.storage = format === 'json' ? new JsonStorage(path) : new YamlStorage(path);

    this.tokenizer = opts.tokenizer ?? defaultTokenizer;
    this.customRenderer = opts.renderer;
    this.maxEdicts = opts.maxEdicts ?? 200;
    this.tokenBudget = opts.tokenBudget ?? 4000;
    this.categoryAllowlist =
      opts.categories && opts.categories.length > 0 ? opts.categories : undefined;

    this._fileConfig = { ...DEFAULT_SCHEMA.config };
  }

  async load(): Promise<void> {
    const schema = await this.storage.read();
    validateFileSchema(schema);

    if (schema.config) {
      this._fileConfig = schema.config;
    }

    this._edicts = (schema.edicts ?? []).map((e) => ({
      ...e,
      category: normalizeCategory(e.category),
      tags: normalizeTags(e.tags ?? []),
    }));

    this._history = schema.history ?? [];

    const { active, expired } = pruneExpired(this._edicts);
    this._edicts = active;
    this._history = [...this._history, ...expired];

    for (const edict of this._edicts) {
      edict._tokens = this.tokenizer(edict.text);
    }

    this._sequentialCounter = this._computeNextSequential();
    this._fileHash = await this.storage.hash();
    this._dirty = expired.length > 0;
    this._loaded = true;
  }

  async save(): Promise<void> {
    if (this._fileHash !== null) {
      const currentHash = await this.storage.hash();
      if (currentHash !== null && currentHash !== this._fileHash) {
        throw new EdictConflictError(this._fileHash, currentHash);
      }
    }

    const schema: EdictFileSchema = {
      version: 1,
      config: {
        maxEdicts: this.maxEdicts,
        tokenBudget: this.tokenBudget,
        categories: this.categoryAllowlist ?? [],
      },
      edicts: this._edicts.map(({ _tokens, ...rest }) => rest as Edict),
      history: this._history,
    };

    await this.storage.write(schema);
    this._fileHash = await this.storage.hash();
    this._dirty = false;
  }

  add(input: EdictInput): Edict {
    validateEdictInput(input);

    const category = normalizeCategory(input.category);
    this._validateCategory(category);
    const tags = normalizeTags(input.tags ?? []);
    const now = new Date().toISOString();

    if (input.key) {
      const existingIdx = this._edicts.findIndex((e) => e.key === input.key);
      if (existingIdx !== -1) {
        return this._supersede(existingIdx, input, category, tags, now);
      }
    }

    if (this._edicts.length >= this.maxEdicts) {
      throw new EdictBudgetExceededError(this.maxEdicts, this._edicts.length);
    }

    const id = input.key ?? this._nextSequentialId();
    const edict: Edict = {
      id,
      text: input.text,
      category,
      tags,
      confidence: input.confidence ?? 'user',
      source: input.source ?? '',
      key: input.key,
      ttl: input.ttl ?? 'durable',
      expiresAt: input.expiresAt,
      created: now,
      updated: now,
      _tokens: this.tokenizer(input.text),
    };

    const newTotal = this.tokenCount() + (edict._tokens ?? 0);
    if (newTotal > this.tokenBudget) {
      throw new EdictBudgetExceededError(this.tokenBudget, newTotal);
    }

    this._edicts.push(edict);
    this._dirty = true;
    return edict;
  }

  remove(id: string): boolean {
    const idx = this._edicts.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this._edicts.splice(idx, 1);
    this._dirty = true;
    return true;
  }

  update(id: string, patch: Partial<EdictInput>): Edict {
    const edict = this._edicts.find((e) => e.id === id);
    if (!edict) throw new EdictNotFoundError(id);

    if (patch.text !== undefined) {
      edict.text = patch.text;
      edict._tokens = this.tokenizer(patch.text);
    }
    if (patch.category !== undefined) {
      edict.category = normalizeCategory(patch.category);
      this._validateCategory(edict.category);
    }
    if (patch.tags !== undefined) {
      edict.tags = normalizeTags(patch.tags);
    }
    if (patch.confidence !== undefined) edict.confidence = patch.confidence;
    if (patch.source !== undefined) edict.source = patch.source;
    if (patch.ttl !== undefined) edict.ttl = patch.ttl;
    if (patch.expiresAt !== undefined) edict.expiresAt = patch.expiresAt;

    edict.updated = new Date().toISOString();
    this._dirty = true;
    return edict;
  }

  get(id: string): Edict | undefined {
    const edict = this._edicts.find((e) => e.id === id);
    if (edict) {
      edict.lastAccessed = new Date().toISOString();
    }
    return edict;
  }

  has(id: string): boolean {
    return this._edicts.some((e) => e.id === id);
  }

  all(): Edict[] {
    return [...this._edicts];
  }

  find(predicate: (e: Edict) => boolean): Edict[] {
    return this._edicts.filter(predicate);
  }

  categories(): string[] {
    return [...new Set(this._edicts.map((e) => e.category))].sort();
  }

  history(): HistoryEntry[] {
    return [...this._history];
  }

  render(format?: 'plain' | 'markdown' | 'json'): string {
    const now = new Date().toISOString();
    for (const edict of this._edicts) {
      edict.lastAccessed = now;
    }

    if (this.customRenderer && !format) {
      return this.customRenderer(this._edicts);
    }

    switch (format ?? 'plain') {
      case 'plain':
        return renderPlain(this._edicts);
      case 'markdown':
        return renderMarkdown(this._edicts);
      case 'json':
        return renderJson(this._edicts);
      default:
        return renderPlain(this._edicts);
    }
  }

  tokenCount(): number {
    return this._edicts.reduce((sum, e) => sum + (e._tokens ?? 0), 0);
  }

  tokenBudgetRemaining(): number {
    return this.tokenBudget - this.tokenCount();
  }

  isOverBudget(): boolean {
    return this.tokenCount() > this.tokenBudget;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  get fileHash(): string {
    return this._fileHash ?? '';
  }

  private _supersede(
    existingIdx: number,
    input: EdictInput,
    category: string,
    tags: string[],
    now: string
  ): Edict {
    const existing = this._edicts[existingIdx];

    const historyId = `${existing.id}__${now.slice(0, 10).replace(/-/g, '')}`;
    this._history.push({
      id: historyId,
      text: existing.text,
      supersededBy: existing.id,
      archivedAt: now,
    });

    existing.text = input.text;
    existing.category = category;
    existing.tags = tags;
    existing.confidence = input.confidence ?? existing.confidence;
    existing.source = input.source ?? existing.source;
    existing.ttl = input.ttl ?? existing.ttl;
    existing.expiresAt = input.expiresAt;
    existing.updated = now;
    existing._tokens = this.tokenizer(input.text);

    this._dirty = true;
    return existing;
  }

  private _validateCategory(category: string): void {
    if (this.categoryAllowlist && !this.categoryAllowlist.includes(category)) {
      throw new EdictCategoryError(category, this.categoryAllowlist);
    }
  }

  private _nextSequentialId(): string {
    this._sequentialCounter++;
    return `e_${String(this._sequentialCounter).padStart(3, '0')}`;
  }

  private _computeNextSequential(): number {
    let max = 0;
    for (const edict of this._edicts) {
      const match = edict.id.match(/^e_(\d+)$/);
      if (match) {
        max = Math.max(max, parseInt(match[1], 10));
      }
    }
    return max;
  }
}
