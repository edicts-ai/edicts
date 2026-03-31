#!/usr/bin/env node
import { readFile, writeFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { EdictStore } from './store.js';
import type { Edict, EdictFileSchema, EdictInput, ReviewResult, CompactionGroup } from './types.js';
import { renderPlain } from './renderer.js';
import { EdictNotFoundError } from './errors.js';

function takeFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

const BOOLEAN_FLAGS = new Set(['--json', '--plain', '--include-permanent', '--replace', '--merge', '--dry-run']);

function takePositional(args: string[]): string[] {
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg.startsWith('--')) {
      if (!BOOLEAN_FLAGS.has(arg)) {
        index += 1;
      }
      continue;
    }
    positionals.push(arg);
  }
  return positionals;
}

function usage(): string {
  return [
    'Usage: edicts [--path FILE] [--format yaml|json] <command> [options]',
    '',
    'Commands:',
    '  add --text TEXT --category CAT [--tags TAGS] [--confidence CONF] [--ttl TTL] [--key KEY] [--source SRC] [--expiresAt DATE] [--expiresIn DURATION]',
    '  list [--json]',
    '  stats',
    '  get <id> [--plain|--json]',
    '  remove <id>',
    '  update <id> [--text TEXT] [--category CAT] [--tags TAGS] [--confidence CONF] [--ttl TTL] [--key KEY] [--source SRC] [--expiresAt DATE] [--expiresIn DURATION]',
    '  search <query> [--json]',
    '  review [--stale-days N] [--include-permanent] [--json]',
    '  compact <id>... --text TEXT [--tags TAGS] [--confidence CONF] [--ttl TTL] [--source SRC] [--expiresAt DATE] [--expiresIn DURATION] [--dry-run]',
    '  export [--format json|yaml] [--output FILE]',
    '  import <file> [--merge|--replace]',
    '  init [--path FILE]  Create a starter edicts.yaml in the current directory',
    '  version             Print version',
  ].join('\n');
}

/**
 * Walk up the directory tree looking for edicts.yaml or edicts.json,
 * similar to how git finds .git/. Returns the first match or null.
 */
function findEdictsFile(startDir: string): string | null {
  let dir = resolve(startDir);
  const root = dirname(dir) === dir ? dir : undefined; // handle edge
  // eslint-disable-next-line no-constant-condition
  while (true) {
    for (const name of ['edicts.yaml', 'edicts.yml', 'edicts.json']) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

function parseStoreFormat(value: string | undefined): 'yaml' | 'json' | undefined {
  if (value === undefined) return undefined;
  if (value === 'yaml' || value === 'json') return value;
  throw new Error(`Invalid format "${value}". Must be yaml or json.`);
}

function parseConfidence(value: string | undefined): Edict['confidence'] | undefined {
  if (!value) return undefined;
  return value as Edict['confidence'];
}

function parseTtl(value: string | undefined): Edict['ttl'] | undefined {
  if (!value) return undefined;
  return value as Edict['ttl'];
}

function parseTags(value: string | undefined): string[] | undefined {
  return value?.split(',').map((v) => v.trim()).filter(Boolean);
}

function keyPrefix(key: string): string {
  for (const separator of ['/', '.']) {
    if (key.includes(separator)) {
      const parts = key.split(separator);
      if (parts.length > 1) {
        return parts.slice(0, -1).join(separator);
      }
    }
  }
  return key;
}

function buildInput(args: string[]): EdictInput {
  return {
    text: takeFlag(args, '--text') ?? '',
    category: takeFlag(args, '--category') ?? '',
    key: takeFlag(args, '--key'),
    source: takeFlag(args, '--source'),
    confidence: parseConfidence(takeFlag(args, '--confidence')),
    ttl: parseTtl(takeFlag(args, '--ttl')),
    expiresAt: takeFlag(args, '--expiresAt'),
    expiresIn: takeFlag(args, '--expiresIn'),
    tags: parseTags(takeFlag(args, '--tags')),
  };
}

function buildPatch(args: string[]): Partial<EdictInput> {
  const patch: Partial<EdictInput> = {};
  const text = takeFlag(args, '--text');
  const category = takeFlag(args, '--category');
  const key = takeFlag(args, '--key');
  const source = takeFlag(args, '--source');
  const confidence = parseConfidence(takeFlag(args, '--confidence'));
  const ttl = parseTtl(takeFlag(args, '--ttl'));
  const expiresAt = takeFlag(args, '--expiresAt');
  const expiresIn = takeFlag(args, '--expiresIn');
  const tags = parseTags(takeFlag(args, '--tags'));

  if (text !== undefined) patch.text = text;
  if (category !== undefined) patch.category = category;
  if (key !== undefined) patch.key = key;
  if (source !== undefined) patch.source = source;
  if (confidence !== undefined) patch.confidence = confidence;
  if (ttl !== undefined) patch.ttl = ttl;
  if (expiresAt !== undefined) patch.expiresAt = expiresAt;
  if (expiresIn !== undefined) patch.expiresIn = expiresIn;
  if (tags !== undefined) patch.tags = tags;
  return patch;
}

function printEdictPlain(edict: Edict): string {
  return renderPlain([edict]);
}

function enrichReview(review: ReviewResult, store: EdictStore, includePermanent: boolean) {
  const expired = store.history().filter((entry) => entry.supersededBy === 'expired');
  const stale = includePermanent
    ? review.stale
    : review.stale.filter((edict) => edict.ttl !== 'permanent');

  return {
    ...review,
    stale,
    expired,
    duplicates: review.compactionCandidates,
  };
}

function printReviewPlain(review: ReturnType<typeof enrichReview>): string {
  const lines: string[] = [];
  lines.push(`stale: ${review.stale.length}`);
  for (const edict of review.stale) {
    lines.push(`  - ${edict.id}: ${edict.text}`);
  }
  lines.push(`expired: ${review.expired.length}`);
  for (const entry of review.expired) {
    lines.push(`  - ${entry.id}: ${entry.text}`);
  }
  lines.push(`duplicates: ${review.duplicates.length}`);
  for (const group of review.duplicates) {
    lines.push(`  - ${group.category}/${group.keyPrefix}: ${group.edicts.map((edict) => edict.id).join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}

async function exportSchema(schema: EdictFileSchema, format: 'yaml' | 'json'): Promise<string> {
  if (format === 'json') {
    return `${JSON.stringify(schema, null, 2)}\n`;
  }
  return stringifyYaml(schema, { indent: 2, lineWidth: 0 });
}

async function loadImportFile(file: string): Promise<EdictFileSchema> {
  const content = await readFile(file, 'utf8');
  if (file.endsWith('.json')) {
    return JSON.parse(content) as EdictFileSchema;
  }
  return parseYaml(content) as EdictFileSchema;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const explicitPath = takeFlag(args, '--path');
  const path = explicitPath ?? findEdictsFile(process.cwd()) ?? './edicts.yaml';
  const format = parseStoreFormat(takeFlag(args, '--format'));
  const positional = takePositional(args);
  const cmd = positional[0];

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    process.stdout.write(`edicts v${pkg.version}\n`);
    return;
  }

  // Handle init before loading store (file may not exist yet)
  if (cmd === 'init') {
    if (existsSync(path)) {
      process.stderr.write(`${path} already exists. Use --path to specify a different file.\n`);
      process.exitCode = 1;
      return;
    }
    const now = new Date().toISOString();
    const template = [
      'version: 1',
      'config:',
      '  maxEdicts: 200',
      '  tokenBudget: 4000',
      '  categories: []',
      'edicts:',
      '  - id: e_001',
      '    text: "Replace this with your first edict"',
      '    category: general',
      '    tags: []',
      '    confidence: verified',
      '    source: manual',
      '    ttl: durable',
      `    created: "${now}"`,
      `    updated: "${now}"`,
      'history: []',
      '',
    ].join('\n');
    await writeFile(path, template, 'utf-8');
    process.stdout.write(`Created ${path}\n`);
    return;
  }

  const store = new EdictStore({ path, format });
  await store.load();

  // Warn on read commands if no edicts file exists on disk
  const readCmds = ['list', 'stats', 'search', 'review', 'export'];
  if (readCmds.includes(cmd)) {
    try {
      await access(path);
    } catch {
      process.stderr.write(`No edicts file found (searched from ${process.cwd()} to /)\nRun 'edicts init' to create one, or use --path to specify a location.\n`);
      process.exitCode = 1;
      return;
    }
  }

  switch (cmd) {
    case 'add': {
      const input = buildInput(args);
      if (!input.text || !input.category) {
        throw new Error(`add requires --text and --category\n${usage()}`);
      }

      const result = await store.add(input);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case 'list': {
      if (hasFlag(args, '--json')) {
        process.stdout.write(`${await store.render('json')}\n`);
      } else {
        process.stdout.write(`${await store.render('plain')}\n`);
      }
      break;
    }
    case 'stats': {
      process.stdout.write(`${JSON.stringify(await store.stats(), null, 2)}\n`);
      break;
    }
    case 'get': {
      const id = positional[1];
      if (!id) throw new Error(`get requires <id>\n${usage()}`);
      const edict = await store.get(id);
      if (!edict) throw new EdictNotFoundError(id);
      if (hasFlag(args, '--plain')) {
        process.stdout.write(`${printEdictPlain(edict)}\n`);
      } else {
        process.stdout.write(`${JSON.stringify(edict, null, 2)}\n`);
      }
      break;
    }
    case 'remove': {
      const id = positional[1];
      if (!id) throw new Error(`remove requires <id>\n${usage()}`);
      const result = await store.remove(id);
      if (!result.found || !result.edict) throw new EdictNotFoundError(id);
      process.stdout.write(`Removed ${result.edict.id}: ${result.edict.text}\n`);
      break;
    }
    case 'update': {
      const id = positional[1];
      if (!id) throw new Error(`update requires <id>\n${usage()}`);
      const patch = buildPatch(args);
      if (Object.keys(patch).length === 0) {
        throw new Error(`update requires at least one field to change\n${usage()}`);
      }
      const result = await store.update(id, patch);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case 'search': {
      const query = positional.slice(1).join(' ');
      if (!query) throw new Error(`search requires <query>\n${usage()}`);
      const results = await store.search(query);
      if (hasFlag(args, '--json')) {
        process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
      } else if (results.length > 0) {
        process.stdout.write(`${renderPlain(results)}\n`);
      }
      break;
    }
    case 'review': {
      const staleDays = takeFlag(args, '--stale-days');
      const includePermanent = hasFlag(args, '--include-permanent');
      const reviewStore = staleDays !== undefined
        ? new EdictStore({ path, format, staleThresholdDays: Number(staleDays) })
        : store;
      if (reviewStore !== store) {
        await reviewStore.load();
      }
      const review = enrichReview(await reviewStore.review(), reviewStore, includePermanent);
      if (hasFlag(args, '--json')) {
        process.stdout.write(`${JSON.stringify(review, null, 2)}\n`);
      } else {
        process.stdout.write(printReviewPlain(review));
      }
      break;
    }
    case 'compact': {
      // edicts compact <id>... --text TEXT [--tags TAGS] [--confidence CONF] [--ttl TTL] [--source SRC] [--expiresAt DATE] [--expiresIn DURATION] [--dry-run]
      // Merges the specified edicts into a single replacement edict.
      // All specified edicts must share the same category and key prefix.
      const ids = positional.slice(1);
      if (ids.length < 2) {
        throw new Error(`compact requires at least 2 edict IDs to merge\n${usage()}`);
      }
      const mergedText = takeFlag(args, '--text');
      if (!mergedText) {
        throw new Error(`compact requires --text TEXT for the merged edict\n${usage()}`);
      }
      const dryRun = hasFlag(args, '--dry-run');

      // Resolve edicts by id
      const allEdicts = await store.all();
      const toCompact: Edict[] = [];
      for (const id of ids) {
        const found = allEdicts.find((e) => e.id === id);
        if (!found) throw new EdictNotFoundError(id);
        toCompact.push(found);
      }

      // Validate same category and key prefix
      const categories = new Set(toCompact.map((e) => e.category));
      if (categories.size > 1) {
        throw new Error(`compact: all edicts must share the same category, got: ${[...categories].join(', ')}`);
      }
      const category = toCompact[0].category;
      const keys = toCompact.map((e) => e.key).filter(Boolean);
      if (keys.length > 0 && keys.length !== toCompact.length) {
        throw new Error(`compact: all edicts must either all have keys or all be keyless`);
      }
      if (keys.length === toCompact.length) {
        const keyPrefixes = new Set(keys.map((key) => keyPrefix(key)));
        if (keyPrefixes.size > 1) {
          throw new Error(`compact: all keyed edicts must share the same key prefix, got: ${[...keyPrefixes].join(', ')}`);
        }
      }

      // Build merged input — inherit category, allow overrides via flags
      const mergedInput: EdictInput = {
        text: mergedText,
        category,
        key: toCompact[0].key ?? undefined,
        tags: parseTags(takeFlag(args, '--tags')) ?? [...new Set(toCompact.flatMap((e) => e.tags ?? []))],
        confidence: parseConfidence(takeFlag(args, '--confidence')) ?? toCompact[0].confidence,
        ttl: parseTtl(takeFlag(args, '--ttl')) ?? toCompact[0].ttl,
        source: takeFlag(args, '--source') ?? toCompact[0].source,
        expiresAt: takeFlag(args, '--expiresAt'),
        expiresIn: takeFlag(args, '--expiresIn'),
      };

      const group: CompactionGroup = { keyPrefix: toCompact[0].key ?? toCompact[0].id, category, edicts: toCompact };

      if (dryRun) {
        process.stdout.write(`DRY RUN — would compact ${ids.join(', ')} into:\n`);
        process.stdout.write(`${JSON.stringify(mergedInput, null, 2)}\n`);
        break;
      }

      const result = await store.compact(group, mergedInput);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case 'export': {
      const exportFormat = parseStoreFormat(takeFlag(args, '--format')) ?? 'yaml';
      const output = takeFlag(args, '--output');
      const serialized = await exportSchema(store.exportData(), exportFormat);
      if (output) {
        await writeFile(output, serialized, 'utf8');
      } else {
        process.stdout.write(serialized);
      }
      break;
    }
    case 'import': {
      const file = positional[1];
      if (!file) throw new Error(`import requires <file>\n${usage()}`);
      const merge = hasFlag(args, '--merge') || !hasFlag(args, '--replace');
      const imported = await loadImportFile(file);
      let data = imported;

      if (merge) {
        const current = store.exportData();
        const historyById = new Map([...current.history, ...(imported.history ?? [])].map((entry) => [entry.id, entry]));
        const edictById = new Map([...current.edicts, ...(imported.edicts ?? [])].map((edict) => [edict.id, edict]));
        data = {
          version: imported.version ?? current.version,
          config: imported.config ?? current.config,
          edicts: [...edictById.values()],
          history: [...historyById.values()],
        };
      }

      const result = await store.importData(data);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case undefined:
      process.stdout.write(`${usage()}\n`);
      break;
    default:
      process.stdout.write(`${usage()}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
