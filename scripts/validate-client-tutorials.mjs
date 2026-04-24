#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const clients = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    binary: 'claude',
    versionArgs: ['--version'],
    tutorialFlow: ['edicts init', 'edicts update e_001', 'edicts list', 'claude --append-system-prompt'],
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    binary: 'codex',
    versionArgs: ['--version'],
    tutorialFlow: ['edicts init', 'edicts update e_001', 'edicts list', 'codex exec'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    binary: 'cursor',
    versionArgs: ['--version'],
    tutorialFlow: ['edicts init', 'edicts update e_001', 'edicts list', 'Cursor Rules / docs context'],
  },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  };
}

function which(binary) {
  const result = spawnSync('bash', ['-lc', 'command -v -- "$1"', '_', binary], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function requireOk(result) {
  if (result.status !== 0) {
    throw new Error(`${result.command} failed with ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result;
}

const repoRoot = process.cwd();
requireOk(run('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'pipe' }));
const packOutput = execFileSync('npm', ['pack', '--silent'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').at(-1);
const tarball = join(repoRoot, packOutput);
const workspace = mkdtempSync(join(tmpdir(), 'edicts-client-tutorial-'));

try {
  requireOk(run('npm', ['init', '-y'], { cwd: workspace }));
  requireOk(run('npm', ['install', tarball], { cwd: workspace }));
  const edictsPath = join(workspace, 'edicts.yaml');
  requireOk(run('npx', ['edicts', '--path', edictsPath, 'init'], { cwd: workspace }));
  requireOk(run('npx', ['edicts', '--path', edictsPath, 'update', 'e_001', '--text', 'The verified launch codename is TULIP-42.', '--category', 'product', '--confidence', 'verified', '--ttl', 'durable'], { cwd: workspace }));
  const list = requireOk(run('npx', ['edicts', '--path', edictsPath, 'list'], { cwd: workspace }));
  const search = requireOk(run('npx', ['edicts', '--path', edictsPath, 'search', 'TULIP-42'], { cwd: workspace }));
  const stats = requireOk(run('npx', ['edicts', '--path', edictsPath, 'stats'], { cwd: workspace }));
  const statsJson = JSON.parse(stats.stdout);

  if (!list.stdout.includes('TULIP-42')) {
    throw new Error(`edicts list did not include TULIP-42\n${list.stdout}`);
  }
  if (!search.stdout.includes('TULIP-42')) {
    throw new Error(`edicts search did not include TULIP-42\n${search.stdout}`);
  }
  if (statsJson.total !== 1 || statsJson.byCategory?.product !== 1 || statsJson.byConfidence?.verified !== 1) {
    throw new Error(`edicts stats did not reflect the updated e_001 edict\n${stats.stdout}`);
  }

  const clientResults = clients.map((client) => {
    const path = which(client.binary);
    const version = path ? run(client.binary, client.versionArgs).stdout || run(client.binary, client.versionArgs).stderr : '';
    return {
      ...client,
      available: Boolean(path),
      path,
      version,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    packageTarball: packOutput,
    workspace,
    cliSmoke: {
      init: 'passed',
      update: 'passed',
      listContainsEdict: list.stdout.includes('TULIP-42'),
      searchContainsEdict: search.stdout.includes('TULIP-42'),
      statsJson,
    },
    clients: clientResults,
  };

  writeFileSync(join(repoRoot, 'client-tutorial-validation.latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}
