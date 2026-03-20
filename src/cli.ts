#!/usr/bin/env node
import { EdictStore } from './store.js';

function takeFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const path = takeFlag(args, '--path') ?? './edicts.yaml';
  const format = takeFlag(args, '--format') as 'yaml' | 'json' | undefined;

  const positional = args.filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    const prev = args[index - 1];
    if (prev && prev.startsWith('--')) return false;
    return true;
  });
  const cmd = positional[0];

  const store = new EdictStore({ path, format });
  await store.load();

  switch (cmd) {
    case 'add': {
      const text = takeFlag(args, '--text');
      const category = takeFlag(args, '--category');
      const key = takeFlag(args, '--key');
      const source = takeFlag(args, '--source');
      const confidence = takeFlag(args, '--confidence') as 'verified' | 'inferred' | 'user' | undefined;
      const ttl = takeFlag(args, '--ttl') as 'ephemeral' | 'event' | 'durable' | 'permanent' | undefined;
      const expiresAt = takeFlag(args, '--expiresAt');
      const tags = takeFlag(args, '--tags')?.split(',').map((v) => v.trim()).filter(Boolean);

      if (!text || !category) {
        throw new Error('add requires --text and --category');
      }

      const result = store.add({ text, category, key, source, confidence, ttl, expiresAt, tags });
      await store.save();
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case 'list': {
      if (hasFlag(args, '--json')) {
        process.stdout.write(`${store.render('json')}\n`);
      } else {
        process.stdout.write(`${store.render('plain')}\n`);
      }
      break;
    }
    case 'stats': {
      process.stdout.write(`${JSON.stringify(store.stats(), null, 2)}\n`);
      break;
    }
    default:
      process.stdout.write(
        'Usage: edicts [--path FILE] [--format yaml|json] <add|list|stats> [options]\n'
      );
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
