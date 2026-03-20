import { EdictStore } from '../store.js';
import type { EdictInput, FindQuery } from '../types.js';
import type { EdictsPluginConfig } from './types.js';
import { resolveEnabledToolNames, toStoreOptions } from './config.js';

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function stringSchema(): { type: 'string' } {
  return { type: 'string' };
}

function enumSchema<T extends readonly string[]>(values: T): { type: 'string'; enum: T } {
  return { type: 'string', enum: values };
}

const confidenceSchema = enumSchema(['verified', 'inferred', 'user'] as const);
const ttlSchema = enumSchema(['ephemeral', 'event', 'durable', 'permanent'] as const);

const listParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: stringSchema(),
    tag: stringSchema(),
    confidence: confidenceSchema,
    ttl: ttlSchema,
    text: stringSchema(),
  },
} as const;

const getParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: stringSchema(),
  },
  required: ['id'],
} as const;

const addParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: stringSchema(),
    category: stringSchema(),
    key: stringSchema(),
    tags: { type: 'array', items: stringSchema() },
    confidence: confidenceSchema,
    source: stringSchema(),
    ttl: ttlSchema,
    expiresAt: stringSchema(),
    expiresIn: {
      anyOf: [stringSchema(), { type: 'number' }],
    },
  },
  required: ['text', 'category'],
} as const;

const updateParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: stringSchema(),
    text: stringSchema(),
    category: stringSchema(),
    key: stringSchema(),
    tags: { type: 'array', items: stringSchema() },
    confidence: confidenceSchema,
    source: stringSchema(),
    ttl: ttlSchema,
    expiresAt: stringSchema(),
    expiresIn: {
      anyOf: [stringSchema(), { type: 'number' }],
    },
  },
  required: ['id'],
} as const;

const searchParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: stringSchema(),
  },
  required: ['query'],
} as const;

const emptyParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;

async function ensureLoaded(store: EdictStore): Promise<EdictStore> {
  await store.load();
  return store;
}

type ToolContentResult = Promise<{ content: Array<{ type: 'text'; text: string }> }>;

type EdictsTool = {
  name: string;
  description: string;
  parameters: unknown;
  execute: (id: string, params?: any) => ToolContentResult;
};

export function createEdictsTools(config?: EdictsPluginConfig, store?: EdictStore): EdictsTool[] {
  const names = new Set(resolveEnabledToolNames(config));
  const tools: EdictsTool[] = [];
  const sharedStore = store ?? new EdictStore(toStoreOptions(config));

  if (names.has('edicts_list')) {
    tools.push({
      name: 'edicts_list',
      description: 'List active edicts, optionally filtered by category, tag, confidence, ttl, or text.',
      parameters: listParameters,
      async execute(_id: string, params: FindQuery = {}) {
        const result = await ensureLoaded(sharedStore).then((loadedStore) => loadedStore.find(params));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_get')) {
    tools.push({
      name: 'edicts_get',
      description: 'Get a single edict by id.',
      parameters: getParameters,
      async execute(_id: string, params: { id: string }) {
        const result = await ensureLoaded(sharedStore).then((loadedStore) => loadedStore.get(params.id));
        return { content: [{ type: 'text', text: serialize(result ?? null) }] };
      },
    });
  }

  if (names.has('edicts_add')) {
    tools.push({
      name: 'edicts_add',
      description: 'Create a new edict or supersede an existing one by key.',
      parameters: addParameters,
      async execute(_id: string, params: EdictInput) {
        const result = await ensureLoaded(sharedStore).then((loadedStore) => loadedStore.add(params));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_update')) {
    tools.push({
      name: 'edicts_update',
      description: 'Update an existing edict by id.',
      parameters: updateParameters,
      async execute(_id: string, params: { id: string } & Partial<EdictInput>) {
        const { id, ...patch } = params;
        const result = await ensureLoaded(sharedStore).then((loadedStore) => loadedStore.update(id, patch));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_remove')) {
    tools.push({
      name: 'edicts_remove',
      description: 'Remove an edict by id.',
      parameters: getParameters,
      async execute(_id: string, params: { id: string }) {
        const result = await ensureLoaded(sharedStore).then((loadedStore) => loadedStore.remove(params.id));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_search')) {
    tools.push({
      name: 'edicts_search',
      description: 'Search edicts across ids, keys, text, category, source, and tags.',
      parameters: searchParameters,
      async execute(_id: string, params: { query: string }) {
        const result = await ensureLoaded(sharedStore).then((loadedStore) => loadedStore.search(params.query));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_stats')) {
    tools.push({
      name: 'edicts_stats',
      description: 'Return edict store statistics.',
      parameters: emptyParameters,
      async execute() {
        const result = await ensureLoaded(sharedStore).then((loadedStore) => loadedStore.stats());
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  return tools;
}
