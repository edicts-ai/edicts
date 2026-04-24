# Edicts client tutorial validation matrix

Status: pre-publication validation gate for the Edicts tutorial drafts.
Last run: 2026-04-24 06:09 UTC.

## Publication gate

Do **not** create a publication approval Decision Center item until this matrix and the latest smoke-test results are attached to the CCC task transcript.

Required before publication:

1. Run `npm run validate:client-tutorials` from the repo root.
2. Run one real-client smoke test for every authenticated client available in the environment.
3. Update tutorial drafts for any command or UX mismatch found during testing.
4. Attach this matrix plus `docs/integrations/client-smoke-results-2026-04-24.md` to the task transcript.
5. Only then create the follow-up publication approval decision.

## Repeatable local validation

Smoke test command:

```bash
npm run validate:client-tutorials
```

What it validates:

- Builds the local package with `npm run build`.
- Packs the package with `npm pack`.
- Installs the tarball into a temporary clean npm project.
- Runs the tutorial's core CLI flow with an explicit `--path`:
  - `edicts init`
  - `edicts update`
  - `edicts list`
  - `edicts search`
  - `edicts stats`
- Detects local Claude Code, Codex CLI, and Cursor binaries plus versions.

## Client matrix

| Client | Tutorial flow under test | Smoke test command | 2026-04-24 result | Publication status |
|---|---|---|---|---|
| Claude Code | Generate edicts context with `npx edicts list`, inject with `claude --append-system-prompt`, verify the model follows the edict. | `claude -p --no-session-persistence --append-system-prompt "$ctx" 'Answer with only the verified launch codename from the standing rules.'` | PASS. Claude Code 2.1.117 returned `TULIP-42`. | Ready, with docs note to use `--append-system-prompt` for explicit CLI smoke tests. |
| Codex CLI | Generate edicts context with `npx edicts list`, pass it in the `codex exec` prompt, verify the model follows the edict. | `codex -a never exec --skip-git-repo-check --sandbox read-only --output-last-message "$out" "Use these standing rules exactly:\n$ctx\n..."` | BLOCKED BY AUTH. Codex CLI 0.124.0 is installed, but the real-client call failed with OpenAI 401 Unauthorized. | Not publication-blocking if documented as unavailable-auth; rerun after Codex auth is fixed. |
| Cursor | Generate edicts context with `npx edicts list`, paste or sync it into Cursor Rules / project context, verify the chat follows the edict. | `cursor --version` plus manual Cursor Rules smoke test. | NOT AVAILABLE. No `cursor` binary in PATH on this host. | Gap documented; tutorial should label Cursor flow as manual until a Cursor-capable host is available. |

## Tutorial corrections found

- `edicts init` creates a starter `e_001` edict. Tutorial flows should either update that starter (`edicts update e_001 ...`) or tell users to remove/replace it before treating stats/counts as meaningful.
- CLI `add` requires `--text` and `--category`; the positional example `edicts add "..." --category product` is wrong and has been corrected.
- Because the CLI searches parent directories for `edicts.yaml`, validation scripts and copy-pasteable smoke tests should use `--path ./edicts.yaml` in temporary directories to avoid accidentally finding a parent `/tmp/edicts.yaml`.
- Claude Code has a clean non-interactive injection path via `--append-system-prompt`; prefer that in the tutorial over relying on ambient project files for the smoke test.
- Codex CLI's approval flag is global in this installed version (`codex -a never exec ...`), despite help text implying `codex exec --ask-for-approval never`.

## Evidence files

- Current run notes: `docs/integrations/client-smoke-results-2026-04-24.md`
- Repeatable validator: `scripts/validate-client-tutorials.mjs`
- Regression coverage: `tests/client-validation-matrix.test.ts`
