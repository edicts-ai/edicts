# Lifecycle Management — TTL, Expiry, Pruning & Compaction

> **Task:** #343  
> **Date:** 2026-03-20  
> **Status:** Approved

## Goal

Implement the lifecycle system that keeps the edict store lean and current. Covers duration-based expiry, universal auto-pruning, capacity warnings, auto-save, stale review surfacing, and agent-assisted compaction.

## Architecture

Extends the existing `EdictStore` with new configuration options, async methods, and two new public APIs (`review()` and `compact()`). No new files — all changes land in existing modules. The library remains framework-agnostic with zero AI dependencies; compaction is callback-driven (caller provides merged text).

## Tech Stack

No new dependencies. Uses existing `yaml`, `vitest`, `tsup` toolchain.

---

## Section 1: New Configuration Options

New fields on `EdictStoreOptions`:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `staleThresholdDays` | `number` | `90` | Durable edicts not accessed in this many days are surfaced for review |
| `categoryLimits` | `Record<string, number>` | `undefined` | Per-category soft limits (warn on exceed) |
| `defaultCategoryLimit` | `number` | `undefined` | Fallback soft limit for unlisted categories |
| `defaultEphemeralTtlSeconds` | `number` | `86400` (24h) | Auto-assigned expiry for ephemeral edicts with no explicit expiry |
| `autoSave` | `boolean` | `true` | Auto-save after mutations and prune operations |

These are also persisted in the file's `config` section so they survive round-trips (except `autoSave` which is runtime-only).

## Section 2: Input Changes & Duration Parsing

New field on `EdictInput`:

```typescript
/** Duration until expiry. String: '30m', '2h', '7d'. Number or numeric string: seconds. */
expiresIn?: string | number;
```

**Parsing rules** (new `parseDuration()` utility):
- `number` → seconds directly
- `string` of only digits → parse as seconds
- `string` with suffix → `30m` = 1800s, `2h` = 7200s, `7d` = 604800s
- Supported suffixes: `m` (minutes), `h` (hours), `d` (days)
- Invalid format → `EdictValidationError`

**Resolution in `add()`:**
1. Both `expiresAt` and `expiresIn` provided → `EdictValidationError`
2. `expiresIn` provided → compute `expiresAt = now + duration`, store absolute timestamp
3. `ttl === 'ephemeral'` with neither `expiresAt` nor `expiresIn` → auto-assign `expiresAt = now + defaultEphemeralTtlSeconds`
4. Only `expiresAt` is stored on disk — `expiresIn` is a pure input convenience, never persisted

**No changes to `Edict` type** — stored edicts still only have `expiresAt`.

## Section 3: Pruning on All Reads

Call `_autoPrune()` at the top of every public method that returns edict data:
- `get()`, `find()`, `search()`, `all()`, `render()`, `stats()`
- In addition to existing: `add()`, `remove()`, `update()`

`has()` does NOT prune — it stays a cheap boolean check.

`_autoPrune()` itself is unchanged in logic: calls `pruneExpired()`, moves expired edicts to history, sets `dirty = true`.

## Section 4: Capacity Warnings

**New type:**

```typescript
interface CapacityStatus {
  /** Count usage: edicts.length / maxEdicts (0.0 - 1.0+) */
  countUsage: number;
  /** Token usage: tokenCount / tokenBudget (0.0 - 1.0+) */
  tokenUsage: number;
  /** Per-category breakdown */
  categories: Record<string, { count: number; limit?: number; overLimit: boolean }>;
  /** Human-readable warnings */
  warnings: string[];
}
```

**Warnings on `MutationResult`:**

Add optional `warnings?: string[]` to `MutationResult`. Populated after a successful `add()` or `update()` when:
- Count > 80% of `maxEdicts`
- Tokens > 80% of `tokenBudget`
- Category exceeds its soft limit

Warnings are informational — the operation still succeeds.

**New method `capacityStatus(): CapacityStatus`:**

Returns full capacity picture on demand. Also used internally to generate mutation warnings (DRY).

## Section 5: Auto-Save on Mutation and Prune

**`_autoPrune()` becomes async:**

```typescript
private async _autoPrune(): Promise<number> {
  const { active, expired } = pruneExpired(this._edicts);
  if (expired.length === 0) return 0;
  this._edicts = active;
  this._history = [...this._history, ...expired];
  this._dirty = true;
  if (this.autoSave) await this.save();
  return expired.length;
}
```

**All public methods that call `_autoPrune()` become async:**

| Method | New Return Type |
|--------|----------------|
| `add()` | `Promise<MutationResult>` |
| `remove()` | `Promise<MutationResult>` |
| `update()` | `Promise<MutationResult>` |
| `get()` | `Promise<Edict \| undefined>` |
| `find()` | `Promise<Edict[]>` |
| `search()` | `Promise<Edict[]>` |
| `all()` | `Promise<Edict[]>` |
| `render()` | `Promise<string>` |
| `stats()` | `Promise<EdictStats>` |

Mutations auto-save after their own changes too (if `autoSave` is true). Prune + mutation may produce two writes in the worst case — acceptable for correctness.

**Methods that stay sync:** `has()`, `categories()`, `history()`, `tokenCount()`, `tokenBudgetRemaining()`, `isOverBudget()`, `capacityStatus()`, `exportData()`.

**CLI:** Remove explicit `save()` call after `add` — auto-save handles it.

## Section 6: Review Method & Compaction

**New types:**

```typescript
interface CompactionGroup {
  /** Shared key prefix */
  keyPrefix: string;
  /** Category (all edicts in group share same category) */
  category: string;
  /** The edicts that could be merged */
  edicts: Edict[];
}

interface ReviewOptions {
  /** How far ahead to look for expiring edicts. Default: 7 days */
  expiryLookaheadDays?: number;
}

interface ReviewResult {
  /** Durable edicts not accessed within staleThresholdDays */
  stale: Edict[];
  /** Edicts expiring within the lookahead window */
  expiringSoon: Edict[];
  /** Current capacity status */
  capacity: CapacityStatus;
  /** Groups of edicts that could be merged */
  compactionCandidates: CompactionGroup[];
}
```

**`review(options?: ReviewOptions): ReviewResult`** — sync, no pruning (diagnostic snapshot):

1. **Stale detection:** Durable edicts where `lastAccessed` (or `created` if never accessed) is older than `now - staleThresholdDays`.
2. **Expiring soon:** Edicts with `expiresAt` within the lookahead window that haven't expired yet.
3. **Capacity:** Calls `capacityStatus()` internally.
4. **Compaction candidates:** Groups edicts sharing same category AND key prefix (split on `/`, `.`, or `-`). Groups < 2 excluded. Only keyed edicts eligible.

**`compact(group: CompactionGroup, merged: EdictInput): Promise<MutationResult>`:**

Takes a compaction group and caller-provided merged edict. Removes all edicts in the group (moving to history), then adds the merged edict. Atomic — if add fails (budget exceeded), removals are rolled back.

---

## Acceptance Criteria

1. `expiresIn` field on `EdictInput` accepts string durations (`'30m'`, `'2h'`, `'7d'`) and numbers/numeric strings (seconds)
2. Ephemeral edicts without explicit expiry get auto-assigned `expiresAt` based on `defaultEphemeralTtlSeconds`
3. Providing both `expiresAt` and `expiresIn` throws `EdictValidationError`
4. `_autoPrune()` runs on all read methods (`get`, `find`, `search`, `all`, `render`, `stats`) in addition to mutations
5. `capacityStatus()` returns count/token usage ratios, per-category breakdown, and warnings
6. `MutationResult` includes `warnings` when store exceeds 80% capacity or category soft limits
7. `autoSave` option (default `true`) causes mutations and prune to persist automatically
8. All methods calling `_autoPrune()` are async and return Promises
9. `review()` surfaces stale durable edicts, expiring-soon edicts, capacity status, and compaction candidates
10. `compact()` atomically replaces a group of edicts with a single merged edict, with rollback on failure
11. `categoryLimits` and `defaultCategoryLimit` produce warnings (not errors) when exceeded
12. `staleThresholdDays` is configurable (default 90)
13. All existing 115 tests continue to pass (updated for async signatures)
14. New tests cover all new functionality with >95% branch coverage on new code
15. `npm run build` and `npm run lint` pass cleanly
