# Client smoke results — 2026-04-24

Task: Design and run Edicts client integration tests before tutorial publication.

## Environment

- Repo: `/home/jeanclaude/workspace/edicts-worktrees/feat/design-and-run-edicts-client-integration`
- Node: v22.22.2
- npm: 10.9.7
- Claude Code: `2.1.117 (Claude Code)` at `/home/jeanclaude/.local/bin/claude`
- Codex CLI: `codex-cli 0.124.0` at `/usr/bin/codex`
- Cursor: unavailable (`cursor: command not found`)

## Repeatable validator

Command:

```bash
npm run validate:client-tutorials
```

Result: PASS.

Evidence:

- `npm run build` completed inside the validator.
- `npm pack --silent` produced `edicts-1.1.0.tgz`.
- Temporary package install succeeded.
- CLI flow succeeded with explicit path:
  - `npx edicts --path <tmp>/edicts.yaml init`
  - `npx edicts --path <tmp>/edicts.yaml update e_001 --text "The verified launch codename is TULIP-42." --category product --confidence verified --ttl durable`
  - `npx edicts --path <tmp>/edicts.yaml list`
  - `npx edicts --path <tmp>/edicts.yaml search TULIP-42`
  - `npx edicts --path <tmp>/edicts.yaml stats`
- Detected clients:
  - Claude Code available: yes
  - Codex CLI available: yes
  - Cursor available: no

## Claude Code real-client smoke

Setup:

```bash
cd "$tmp"
npx edicts --path ./edicts.yaml init
npx edicts --path ./edicts.yaml update e_001 \
  --text 'The verified launch codename is TULIP-42.' \
  --category product
ctx=$(npx edicts --path ./edicts.yaml list)
claude -p --no-session-persistence \
  --append-system-prompt "$ctx" \
  'Answer with only the verified launch codename from the standing rules.'
```

Output:

```text
Context:
- The verified launch codename is TULIP-42. ([verified], product)

Claude smoke:
TULIP-42
```

Result: PASS.

## Codex CLI real-client smoke attempt

Setup:

```bash
cd "$tmp"
npx edicts --path ./edicts.yaml init
npx edicts --path ./edicts.yaml update e_001 \
  --text 'The verified launch codename is TULIP-42.' \
  --category product
ctx=$(npx edicts --path ./edicts.yaml list)
codex -a never exec \
  --skip-git-repo-check \
  --sandbox read-only \
  --output-last-message "$out" \
  "Use these standing rules exactly:\n$ctx\n\nAnswer with only the verified launch codename from the standing rules."
```

Observed result:

```text
OpenAI Codex v0.124.0 (research preview)
approval: never
sandbox: read-only
ERROR: unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses
```

Result: BLOCKED BY AUTH.

Notes:

- The installed Codex help shows `--ask-for-approval`, but this build rejected `codex exec --ask-for-approval never`.
- The working syntax for this installed version is the global flag form: `codex -a never exec ...`.
- The client binary exists, but the authenticated real-model smoke could not complete because credentials are missing/invalid.

## Cursor smoke

Command:

```bash
cursor --version
```

Observed result:

```text
cursor: command not found
```

Result: NOT AVAILABLE ON THIS HOST.

Tutorial implication: keep Cursor instructions as a manual flow until a Cursor-capable host is available for a real smoke test.
