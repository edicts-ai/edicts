import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // CLI tests spawn `npx tsx` subprocesses; cold CI runners can exceed the
    // 5s default (flaked on GH Actions 2026-07-22). 30s is generous headroom.
    testTimeout: 30_000,
  },
});
