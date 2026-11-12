import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validatePortable, inspectTree } from '../scripts/lib/conformance.mjs';
import { validateSkillContent } from '../scripts/lib/skill-frontmatter.mjs';
const manifest = { $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'test-plugin' };
function fixture(t, server) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taruvi-conformance-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest));
  if (server) fs.writeFileSync(path.join(dir, 'mcp.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { test: server } }));
  return dir;
}
test('official schema rejects invalid names, types and unknown fields', t => {
  const dir = fixture(t);
  assert.deepEqual(validatePortable(dir), []);
  for (const change of [{ name: 'bad..name' }, { version: 42 }, { skills: './skills' }, { extensions: { 'com.test': false } }]) {
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ ...manifest, ...change }));
    assert.ok(validatePortable(dir).length, JSON.stringify(change));
  }
});
for (const server of [
  { type: 'stdio', command: '' },
  { type: 'stdio', command: 'node --help' },
  { type: 'stdio', command: 'node', env: { PLUGIN_ROOT: 'wrong' } },
  { type: 'stdio', command: 'node', cwd: './../../' },
  { type: 'stdio', command: 'node', cwd: '${PLUGIN_ROOT}/../' },
  { type: 'stdio', command: 'node', cwd: '${PLUGIN_DATA}/../../' },
  { type: 'stdio', command: 'node', cwd: '${PLUGIN_DATA}suffix' },
  { type: 'http', url: 'https://example.com/mcp' },
  { type: 'streamable-http', url: 'http://example.com/mcp' },
  { type: 'streamable-http', url: 'https://user:pass@example.com/mcp' },
  { type: 'streamable-http', url: 'https://example.com/mcp#' },
  { type: 'streamable-http', url: 'https://${TENANT}.example.com/mcp' },
  { type: 'streamable-http', url: 'https://example.com', headers: { Foo: 'one', foo: 'two' } },
  { type: 'streamable-http', url: 'https://example.com', headers: { Foo: 'a\nb' } },
]) test(`reject invalid MCP configuration ${JSON.stringify(server)}`, t => assert.ok(validatePortable(fixture(t, server)).length));
for (const server of [
  { type: 'stdio', command: 'node', cwd: '${PLUGIN_ROOT}', args: ['${PLUGIN_DATA}/cache'] },
  { type: 'stdio', command: 'node', cwd: '${PLUGIN_DATA}/cache' },
  { type: 'streamable-http', url: 'http://127.0.0.2/mcp' },
  { type: 'streamable-http', url: 'http://[::1]/mcp' },
  { type: 'streamable-http', url: 'https://example.com/mcp' },
]) test(`accept valid MCP configuration ${JSON.stringify(server)}`, t => assert.deepEqual(validatePortable(fixture(t, server)), []));
test('reject escaping support files and cycles, allow contained symlinks', t => {
  const dir = fixture(t), sub = path.join(dir, 'skills'); fs.mkdirSync(sub);
  fs.symlinkSync(os.tmpdir(), path.join(sub, 'escape'));
  assert.throws(() => inspectTree(dir, 'skills'), /escapes/);
  fs.unlinkSync(path.join(sub, 'escape')); fs.symlinkSync('.', path.join(sub, 'cycle'));
  assert.throws(() => inspectTree(dir, 'skills'), /cycle/);
  fs.unlinkSync(path.join(sub, 'cycle')); fs.writeFileSync(path.join(dir, 'reference'), 'test');
  fs.symlinkSync('../reference', path.join(sub, 'safe')); assert.doesNotThrow(() => inspectTree(dir, 'skills'));
});
test('YAML parser checks duplicate keys, malformed syntax and optional metadata', () => {
  const validate = front => validateSkillContent({ content: `---\n${front}\n---\nBody`, label: 'fixture', expectedName: 'test' });
  assert.deepEqual(validate('name: test\ndescription: "A: valid description"\nmetadata:\n  version: "1"'), []);
  for (const front of ['name: test\nname: test\ndescription: x', 'name: test\ndescription: Bad: YAML', 'name: test\ndescription: x\nmetadata:\n  version: 1', 'name: test\ndescription: x\ncompatibility: ' + 'x'.repeat(501)]) assert.ok(validate(front).length);
});
