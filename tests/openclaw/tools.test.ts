import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEdictsTools } from '../../src/openclaw/tools.js';
import { EdictStore } from '../../src/store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-openclaw-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('OpenClaw edicts tools', () => {
  it('creates seven tools by default', () => {
    const tools = createEdictsTools();
    expect(tools).toHaveLength(7);
  });

  it('can list and get edicts through tool executors', async () => {
    const path = join(tempDir, 'edicts.yaml');
    const store = new EdictStore({ path, autoSave: true });
    await store.load();
    const created = await store.add({ text: 'Alpha fact', category: 'product' });

    const tools = createEdictsTools({ path });
    const listTool = tools.find((tool) => (tool as { name: string }).name === 'edicts_list') as { execute: (id: string, params: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }> };
    const getTool = tools.find((tool) => (tool as { name: string }).name === 'edicts_get') as { execute: (id: string, params: { id: string }) => Promise<{ content: Array<{ text: string }> }> };

    const listed = await listTool.execute('1', {});
    const fetched = await getTool.execute('2', { id: created.edict?.id ?? created.id ?? '' });

    expect(listed.content[0].text).toContain('Alpha fact');
    expect(fetched.content[0].text).toContain('Alpha fact');
  });

  it('honors tool name filtering', () => {
    const tools = createEdictsTools({ tools: { names: ['edicts_list', 'edicts_stats'] } });
    expect(tools).toHaveLength(2);
    expect(tools.map((tool) => (tool as { name: string }).name)).toEqual(['edicts_list', 'edicts_stats']);
  });
});
