# Edicts — Project Rules

## Overview
Standalone TypeScript library for managing ground truth facts for AI agents.
Framework-agnostic — no OpenClaw or other framework dependencies in core.

## Tech Stack
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js >= 20, ESM primary with CJS compatibility
- **Build:** tsup (ESM + CJS dual output with declarations)
- **Tests:** vitest
- **Dependencies:** Only `yaml` (for YAML storage). Keep deps minimal.

## Build & Deploy
```bash
npm run build    # tsup — produces dist/index.js, dist/index.cjs, dist/index.d.ts
npm test         # vitest run — all tests must pass
npm run lint     # tsc --noEmit — type check only
```

**IMPORTANT:** This is a library, NOT a web app. There is no `index.html`, no `vite build`, no dev server.
The build command is `tsup` (via `npm run build`). Do NOT use `vite build`.

## Coding Conventions
- All public methods return `structuredClone()` copies — never expose internal references
- File I/O uses atomic writes (write to tmp file, then rename)
- Optimistic concurrency: SHA-256 content hashing for conflict detection
- Category/tag normalization: lowercase, trim, strip simple plural 's'
- IDs: sequential `e_001`, `e_002` for auto-generated; user-provided `key` as ID when specified

## Testing
- Every public API method must have tests
- Test files mirror source: `src/store.ts` → `tests/store.test.ts`
- Tests use temp directories (cleaned up via afterEach)
- Run `npm test` before committing — all 101+ tests must pass

## Important Notes
- `_tokens` is an internal field — strip from serialized output in `save()`
- History entries use timestamped IDs to avoid collisions: `{id}__{timestamp}_{version}`
- Token budget enforcement: rollback on exceeded (no partial state)
- The `render()` method updates `lastAccessed` on all edicts (marks store dirty)


## Code Style — Section Comments
**NEVER use `=====` or `-----` in section divider comments.**
Agents and tools confuse them with git merge conflict markers.
Use this format instead: `// — Section Name`
