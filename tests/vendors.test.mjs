import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectTree, validatePortable, validateSkillTree } from '../scripts/lib/conformance.mjs';
const repo = fileURLToPath(new URL('../', import.meta.url));
for (const vendor of ['claude', 'codex', 'cursor', 'kiro']) test(`${vendor} package survives copying without its siblings`, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `taruvi-${vendor}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, 'payload', `.${vendor}`), dir, { recursive: true });
  for (const entry of fs.readdirSync(dir)) inspectTree(dir, entry);
  assert.deepEqual(validateSkillTree(dir), []);
  for (const skill of ['taruvi-app-developer', 'taruvi-refine-providers', `${vendor}-setup`, 'context7-mcp']) assert.ok(fs.existsSync(path.join(dir, 'skills', skill, 'SKILL.md')));
  function checkMarkdown(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      assert.equal(entry.isSymbolicLink(), false, file);
      if (entry.isDirectory()) checkMarkdown(file);
      else if (entry.name.endsWith('.md')) {
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^\s)]+)\)/g)) {
          const link = match[1].split('#')[0];
          if (!link || /^[a-z]+:/i.test(link) || link.startsWith('/')) continue;
          assert.ok(fs.existsSync(path.resolve(path.dirname(file), link)), `${file}: missing ${link}`);
        }
      }
    }
  }
  checkMarkdown(path.join(dir, 'skills'));
  const setup = fs.readFileSync(path.join(dir, 'skills', `${vendor}-setup`, 'SKILL.md'), 'utf8');
  assert.ok(setup.includes(fs.readFileSync(path.join(repo, 'src/shared/setup-core.md'), 'utf8')), `${vendor}: must include the complete common setup flow`);
  if (vendor === 'kiro') {
    assert.deepEqual(validatePortable(dir), []);
    const r = spawnSync('python3', [path.join(dir, 'scripts/check-taruvi-setup.py'), '--help'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(r.status, 0, r.stderr);
  }
});

test('vendor validator rejects missing skills, undeclared variables, unsafe key fields and invalid transports', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taruvi-vendor-invalid-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, 'payload'), path.join(dir, 'payload'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'package.json'), path.join(dir, 'package.json'));
  fs.copyFileSync(path.join(repo, 'mcp.json'), path.join(dir, 'mcp.json'));
  const validate = () => {
    const r = spawnSync(process.execPath, [path.join(repo, 'scripts/validate-vendor-files.mjs'), dir], { encoding: 'utf8', timeout: 10000 });
    assert.ifError(r.error); return r;
  };
  assert.equal(validate().status, 0);
  const variants = [
    ['.codex/.mcp.json', value => { value.taruvi.headers = { Authorization: 'Bearer fixture' }; }],
    ['.cursor/mcp.json', value => { value.mcpServers.taruvi.url = 'https://tenant.taruvi.cloud/mcp/'; }],
    ['.cursor/.cursor-plugin/plugin.json', value => { delete value.variables.properties.CONTEXT7_API_KEY; }],
    ['.claude/.claude-plugin/plugin.json', value => { value.userConfig.context7_api_key.sensitive = false; }],
    ['.kiro/workspace-mcp.example.json', value => { value.mcpServers.taruvi.type = 'streamable-http'; }],
    ['.codex/.mcp.json', value => { value.context7.args = 42; }],
  ];
  for (const [relative, mutate] of variants) {
    const file = path.join(dir, 'payload', relative), original = fs.readFileSync(file, 'utf8');
    const value = JSON.parse(original); mutate(value); fs.writeFileSync(file, JSON.stringify(value));
    assert.equal(validate().status, 1, relative); fs.writeFileSync(file, original);
  }
  fs.rmSync(path.join(dir, 'payload/.claude/skills/taruvi-app-developer'), { recursive: true });
  assert.equal(validate().status, 1);
});
