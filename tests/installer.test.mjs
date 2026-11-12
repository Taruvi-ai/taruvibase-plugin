import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const repo = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taruvi-install-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function install(dir, ...args) { return spawnSync(process.execPath, [path.join(repo, 'bin/taruvi-agents-plugin.js'), 'install', '--target', dir, '--allow-non-template', ...args], { encoding: 'utf8', timeout: 10000 }); }
function put(dir, name, value) { const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, value); }
test('fresh install is self-contained and idempotent', t => {
  const dir = fixture(t); assert.equal(install(dir).status, 0);
  for (const vendor of ['claude', 'codex', 'cursor', 'kiro']) {
    const skill = path.join(dir, `.${vendor}/skills/taruvi-app-developer`);
    assert.equal(fs.lstatSync(skill).isSymbolicLink(), false);
    assert.ok(fs.existsSync(path.join(skill, 'references/architecture-overview.md')));
  }
  const workspaceSetup = path.join(dir, '.agents/skills/codex-setup/SKILL.md');
  assert.ok(fs.existsSync(workspaceSetup), 'Codex setup must be discoverable without plugin activation');
  assert.equal(fs.readFileSync(workspaceSetup, 'utf8'), fs.readFileSync(path.join(dir, '.codex/skills/codex-setup/SKILL.md'), 'utf8'));
  const state = fs.readFileSync(path.join(dir, '.taruvi-agents-plugin/state.json'), 'utf8');
  assert.equal(install(dir).status, 0);
  assert.equal(fs.readFileSync(path.join(dir, '.taruvi-agents-plugin/state.json'), 'utf8'), state);
  spawnSync('git', ['init', '-q', dir]);
  for (const file of ['.codex/config.toml', '.kiro/.taruvi-mcp-confirmed', '.taruvi-agents-plugin/backup/example']) assert.equal(spawnSync('git', ['check-ignore', file], { cwd: dir }).status, 0);
});
test('preserves all runtime config and unrelated files, including with force', t => {
  const dir = fixture(t);
  const files = ['.env', '.mcp.json', '.claude/.mcp.json', '.codex/config.toml', '.codex/.mcp.json', '.cursor/mcp.json', '.kiro/settings/mcp.json', '.kiro/mcp.json', '.cursor/custom.txt'];
  for (const f of files) put(dir, f, 'local-config-sentinel');
  for (const args of [[], ['--force']]) {
    const r = install(dir, ...args); assert.equal(r.status, 0, r.stderr);
    for (const f of files) assert.equal(fs.readFileSync(path.join(dir, f), 'utf8'), 'local-config-sentinel', f);
  }
});
test('conflicts fail before any writes, force backs up modified support files', t => {
  const dir = fixture(t), file = '.claude/README.md'; put(dir, file, 'user changes');
  assert.equal(install(dir).status, 1);
  assert.equal(fs.existsSync(path.join(dir, '.agents')), false);
  assert.equal(fs.existsSync(path.join(dir, '.gitignore')), false);
  assert.equal(install(dir, '--force').status, 0);
  const backup = fs.readdirSync(path.join(dir, '.taruvi-agents-plugin')).find(x => x.startsWith('backup-'));
  assert.equal(fs.readFileSync(path.join(dir, '.taruvi-agents-plugin', backup, file), 'utf8'), 'user changes');
  put(dir, file, 'edited again'); assert.equal(install(dir).status, 1);
});
test('unmodified managed files upgrade without force', t => {
  const dir = fixture(t); assert.equal(install(dir).status, 0);
  const file = '.claude/README.md', statePath = path.join(dir, '.taruvi-agents-plugin/state.json');
  // Simulate a previous release by recording its actual installed bytes.
  put(dir, file, 'old release');
  const state = JSON.parse(fs.readFileSync(statePath));
  return import('node:crypto').then(({ createHash }) => {
    state.files[file] = createHash('sha256').update('old release').digest('hex'); fs.writeFileSync(statePath, JSON.stringify(state));
    const result = install(dir); assert.equal(result.status, 0, result.stderr);
    assert.notEqual(fs.readFileSync(path.join(dir, file), 'utf8'), 'old release');
  });
});
test('migrates known legacy links and backs up modified shared skills', t => {
  const dir = fixture(t);
  put(dir, '.agents/skills/taruvi-app-developer/SKILL.md', 'local skill');
  fs.mkdirSync(path.join(dir, '.claude/skills'), { recursive: true });
  fs.symlinkSync('../../.agents/skills/taruvi-app-developer', path.join(dir, '.claude/skills/taruvi-app-developer'));
  const r = install(dir, '--force'); assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.lstatSync(path.join(dir, '.claude/skills/taruvi-app-developer')).isSymbolicLink(), false);
});
test('refuses arbitrary destination symlinks even with force', t => {
  const dir = fixture(t), external = fixture(t); put(external, 'sentinel', 'untouched');
  fs.symlinkSync(external, path.join(dir, '.claude'));
  assert.equal(install(dir, '--force').status, 1);
  assert.equal(fs.readFileSync(path.join(external, 'sentinel'), 'utf8'), 'untouched');
  assert.equal(fs.existsSync(path.join(dir, '.agents')), false);
});
test('template markers required unless explicitly bypassed', t => {
  const dir = fixture(t);
  const r = spawnSync(process.execPath, [path.join(repo, 'bin/taruvi-agents-plugin.js'), 'install', '--target', dir], { encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 1); assert.match(r.stderr, /not a Taruvi template/);
});

function legacyKiro(dir) {
  fs.mkdirSync(path.join(dir, '.kiro'), { recursive: true });
  fs.symlinkSync('../.codex/skills', path.join(dir, '.kiro/skills'));
}
test('migrates whole Kiro skills link, preserving custom skills, support files and empty directories', t => {
  const dir = fixture(t);
  put(dir, '.codex/skills/custom/SKILL.md', 'my skill');
  put(dir, '.codex/skills/custom/resources/example.txt', 'my resource');
  fs.mkdirSync(path.join(dir, '.codex/skills/custom/empty'));
  // Contained links are materialized, so the resulting Kiro copy stands alone.
  fs.symlinkSync('resources/example.txt', path.join(dir, '.codex/skills/custom/example.txt'));
  legacyKiro(dir);
  const r = install(dir); assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.lstatSync(path.join(dir, '.kiro/skills')).isSymbolicLink(), false);
  for (const file of ['SKILL.md', 'resources/example.txt', 'example.txt']) {
    assert.equal(fs.readFileSync(path.join(dir, '.kiro/skills/custom', file), 'utf8'), file === 'SKILL.md' ? 'my skill' : 'my resource');
    assert.equal(fs.lstatSync(path.join(dir, '.kiro/skills/custom', file)).isSymbolicLink(), false);
  }
  assert.ok(fs.statSync(path.join(dir, '.kiro/skills/custom/empty')).isDirectory());
  assert.equal(fs.readFileSync(path.join(dir, '.codex/skills/custom/SKILL.md'), 'utf8'), 'my skill');
  assert.ok(fs.lstatSync(path.join(dir, '.codex/skills/custom/example.txt')).isSymbolicLink());
  assert.equal(install(dir).status, 0);
  assert.equal(fs.readFileSync(path.join(dir, '.kiro/skills/custom/SKILL.md'), 'utf8'), 'my skill');
});
test('Kiro migration conflicts cause no writes and force backs up original shared content before Codex updates', t => {
  const dir = fixture(t), file = 'context7-mcp/SKILL.md';
  put(dir, `.codex/skills/${file}`, 'customized context7');
  put(dir, '.codex/skills/context7-mcp/my-notes.txt', 'keep notes');
  legacyKiro(dir);
  const r = install(dir); assert.equal(r.status, 1); assert.match(r.stderr, /Modified or unmanaged/);
  assert.equal(fs.readlinkSync(path.join(dir, '.kiro/skills')), '../.codex/skills');
  assert.equal(fs.existsSync(path.join(dir, '.agents')), false);
  assert.equal(fs.existsSync(path.join(dir, '.gitignore')), false);
  assert.equal(fs.existsSync(path.join(dir, '.taruvi-agents-plugin')), false);
  const forced = install(dir, '--force'); assert.equal(forced.status, 0, forced.stderr);
  const backup = fs.readdirSync(path.join(dir, '.taruvi-agents-plugin')).find(x => x.startsWith('backup-'));
  for (const vendor of ['kiro', 'codex']) {
    assert.equal(fs.readFileSync(path.join(dir, '.taruvi-agents-plugin', backup, `.${vendor}/skills`, file), 'utf8'), 'customized context7');
    assert.equal(fs.readFileSync(path.join(dir, `.${vendor}/skills/context7-mcp/my-notes.txt`), 'utf8'), 'keep notes');
  }
  assert.equal(fs.readFileSync(path.join(dir, '.kiro/skills', file), 'utf8'), fs.readFileSync(path.join(repo, 'payload/.kiro/skills', file), 'utf8'));
  assert.equal(install(dir).status, 0);
});
for (const kind of ['escape', 'cycle', 'dangling', 'arbitrary', 'target escape']) test(`refuses unsafe legacy Kiro migration: ${kind}, even with force`, t => {
  const dir = fixture(t), external = fixture(t);
  put(external, 'sentinel', 'untouched');
  fs.mkdirSync(path.join(dir, '.codex/skills'), { recursive: true });
  if (kind === 'escape') fs.symlinkSync(external, path.join(dir, '.codex/skills/escape'));
  if (kind === 'cycle') fs.symlinkSync('.', path.join(dir, '.codex/skills/cycle'));
  if (kind === 'dangling') fs.rmSync(path.join(dir, '.codex/skills'), { recursive: true });
  if (kind === 'target escape') {
    fs.rmSync(path.join(dir, '.codex/skills'), { recursive: true });
    fs.symlinkSync(external, path.join(dir, '.codex/skills'));
  }
  legacyKiro(dir);
  if (kind === 'arbitrary') {
    fs.unlinkSync(path.join(dir, '.kiro/skills'));
    fs.symlinkSync(external, path.join(dir, '.kiro/skills'));
  }
  const r = install(dir, '--force'); assert.equal(r.status, 1, r.stdout);
  assert.ok(fs.lstatSync(path.join(dir, '.kiro/skills')).isSymbolicLink());
  assert.equal(fs.existsSync(path.join(dir, '.agents')), false);
  assert.equal(fs.existsSync(path.join(dir, '.gitignore')), false);
  assert.equal(fs.existsSync(path.join(dir, '.taruvi-agents-plugin')), false);
  assert.equal(fs.readFileSync(path.join(external, 'sentinel'), 'utf8'), 'untouched');
});
