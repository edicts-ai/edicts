import { Type } from '@sinclair/typebox';
import { EdictStore } from '../store.js';
import type { EdictInput } from '../types.js';
import type { EdictsPluginConfig } from './types.js';
import { resolveEnabledToolNames, toStoreOptions } from './config.js';

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function withStore<T>(config: EdictsPluginConfig | undefined, fn: (store: EdictStore) => Promise<T>): Promise<T> {
  const store = new EdictStore(toStoreOptions(config));
  await store.load();
  return fn(store);
}

export function createEdictsTools(config?: EdictsPluginConfig): Array<{ name: string; description: string; parameters: unknown; execute: (id: string, params?: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }> }> {
  const names = new Set(resolveEnabledToolNames(config));
  const tools: Array<{ name: string; description: string; parameters: unknown; execute: (id: string, params?: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }> }> = [];

  if (names.has('edicts_list')) {
    tools.push({
      name: 'edicts_list',
      description: 'List active edicts, optionally filtered by category, tag, confidence, ttl, or text.',
      parameters: Type.Object({
        category: Type.Optional(Type.String()),
        tag: Type.Optional(Type.String()),
        confidence: Type.Optional(Type.Union([Type.Literal('verified'), Type.Literal('inferred'), Type.Literal('user')])),
        ttl: Type.Optional(Type.Union([Type.Literal('ephemeral'), Type.Literal('event'), Type.Literal('durable'), Type.Literal('permanent')])),
        text: Type.Optional(Type.String()),
      }, { additionalProperties: false }),
      async execute(_id: string, params: Record<string, unknown>) {
        const result = await withStore(config, async (store) => store.find(params as never));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_get')) {
    tools.push({
      name: 'edicts_get',
      description: 'Get a single edict by id.',
      parameters: Type.Object({ id: Type.String() }, { additionalProperties: false }),
      async execute(_id: string, params: { id: string }) {
        const result = await withStore(config, async (store) => store.get(params.id));
        return { content: [{ type: 'text', text: serialize(result ?? null) }] };
      },
    });
  }

  if (names.has('edicts_add')) {
    tools.push({
      name: 'edicts_add',
      description: 'Create a new edict or supersede an existing one by key.',
      parameters: Type.Object({
        text: Type.String(),
        category: Type.String(),
        key: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
        confidence: Type.Optional(Type.Union([Type.Literal('verified'), Type.Literal('inferred'), Type.Literal('user')])),
        source: Type.Optional(Type.String()),
        ttl: Type.Optional(Type.Union([Type.Literal('ephemeral'), Type.Literal('event'), Type.Literal('durable'), Type.Literal('permanent')])),
        expiresAt: Type.Optional(Type.String()),
        expiresIn: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      }, { additionalProperties: false }),
      async execute(_id: string, params: EdictInput) {
        const result = await withStore(config, async (store) => store.add(params));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_update')) {
    tools.push({
      name: 'edicts_update',
      description: 'Update an existing edict by id.',
      parameters: Type.Object({
        id: Type.String(),
        text: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        key: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
        confidence: Type.Optional(Type.Union([Type.Literal('verified'), Type.Literal('inferred'), Type.Literal('user')])),
        source: Type.Optional(Type.String()),
        ttl: Type.Optional(Type.Union([Type.Literal('ephemeral'), Type.Literal('event'), Type.Literal('durable'), Type.Literal('permanent')])),
        expiresAt: Type.Optional(Type.String()),
        expiresIn: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      }, { additionalProperties: false }),
      async execute(_id: string, params: Record<string, unknown>) {
        const { id, ...patch } = params as { id: string } & Partial<EdictInput>;
        const result = await withStore(config, async (store) => store.update(id, patch));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_remove')) {
    tools.push({
      name: 'edicts_remove',
      description: 'Remove an edict by id.',
      parameters: Type.Object({ id: Type.String() }, { additionalProperties: false }),
      async execute(_id: string, params: { id: string }) {
        const result = await withStore(config, async (store) => store.remove(params.id));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_search')) {
    tools.push({
      name: 'edicts_search',
      description: 'Search edicts across ids, keys, text, category, source, and tags.',
      parameters: Type.Object({ query: Type.String() }, { additionalProperties: false }),
      async execute(_id: string, params: { query: string }) {
        const result = await withStore(config, async (store) => store.search(params.query));
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  if (names.has('edicts_stats')) {
    tools.push({
      name: 'edicts_stats',
      description: 'Return edict store statistics.',
      parameters: Type.Object({}, { additionalProperties: false }),
      async execute() {
        const result = await withStore(config, async (store) => store.stats());
        return { content: [{ type: 'text', text: serialize(result) }] };
      },
    });
  }

  return tools;
}
