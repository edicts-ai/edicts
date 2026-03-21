import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdictStore } from '../src/store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edicts-parallel-writes-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('parallel writes against the same store file', () => {
  it('leave a valid final store without temp-file collisions under concurrent add/save attempts', async () => {
    const path = join(tempDir, 'edicts.yaml');

    const stores = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const store = new EdictStore({ path, autoSave: false });
        await store.load();
        return store;
      })
    );

    const attempts = await Promise.allSettled(
      stores.map((store, index) =>
        store.add({ text: `Fact ${index + 1}`, category: 'test' }).then(async (result) => {
          await store.save();
          return result.edict!.text;
        })
      )
    );

    expect(attempts.every((attempt) => attempt.status === 'fulfilled')).toBe(true);

    const finalStore = new EdictStore({ path, autoSave: false });
    await finalStore.load();

    const edicts = await finalStore.all();
    expect(edicts).toHaveLength(1);
    expect(edicts[0].id).toBe('e_001');
    expect(edicts[0].category).toBe('test');
    expect(/^Fact \d+$/.test(edicts[0].text)).toBe(true);
  });
});
