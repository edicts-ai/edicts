import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import openclawPluginEdicts from '../../src/openclaw/plugin.js';
import type { OpenClawPluginApi, OpenClawTool } from '../../src/openclaw/plugin-api.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-openclaw-plugin-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('OpenClaw plugin registration', () => {
  it('registers tools and before_prompt_build hook with default optional=true', async () => {
    const registerTool = vi.fn();
    const on = vi.fn();

    const api: OpenClawPluginApi = {
      pluginConfig: {
        path: join(tempDir, 'edicts.yaml'),
      },
      registerTool,
      on,
    };

    openclawPluginEdicts.register(api);

    expect(registerTool).toHaveBeenCalledTimes(1);
    const [factory, opts] = registerTool.mock.calls[0] as [() => OpenClawTool[] | OpenClawTool | null, { names?: string[]; optional?: boolean }];
    expect(typeof factory).toBe('function');
    expect(opts).toMatchObject({
      names: [
        'edicts_list',
        'edicts_get',
        'edicts_add',
        'edicts_update',
        'edicts_remove',
        'edicts_search',
        'edicts_stats',
      ],
      optional: true,
    });

    const tools = factory() as OpenClawTool[];
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(7);

    expect(on).toHaveBeenCalledTimes(1);
    const [hookName, handler] = on.mock.calls[0] as ['before_prompt_build', () => Promise<unknown>];
    expect(hookName).toBe('before_prompt_build');

    const result = await handler();
    expect(result).toEqual({
      prependSystemContext: 'Edicts:\nNo edicts loaded.',
    });
  });

  it('passes through tools.optional=false and builds prompt context from store contents', async () => {
    const registerTool = vi.fn();
    const on = vi.fn();
    const path = join(tempDir, 'edicts.yaml');

    const api: OpenClawPluginApi = {
      pluginConfig: {
        path,
        tools: { optional: false },
        systemContextHeading: 'Edicts Context',
      },
      registerTool,
      on,
    };

    openclawPluginEdicts.register(api);

    const [factory, opts] = registerTool.mock.calls[0] as [() => OpenClawTool[] | OpenClawTool | null, { names?: string[]; optional?: boolean }];
    expect(opts?.optional).toBe(false);

    const tools = factory() as OpenClawTool[];
    const addTool = tools.find((tool) => tool.name === 'edicts_add');
    expect(addTool).toBeDefined();
    await addTool!.execute('1', { text: 'Alpha fact', category: 'product' });

    const [, handler] = on.mock.calls[0] as ['before_prompt_build', () => Promise<Record<string, unknown>>];
    const result = await handler();

    expect(result.prependSystemContext).toContain('Edicts Context:');
    expect(result.prependSystemContext).toContain('Alpha fact');
  });
});
