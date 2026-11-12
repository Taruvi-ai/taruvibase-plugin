import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../src/hooks/taruvi/mcp_scope.py', import.meta.url));
const checker = fileURLToPath(new URL('../src/hooks/taruvi/check-taruvi-setup.py', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taruvi-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.kiro/settings'), { recursive: true });
  fs.writeFileSync(path.join(root, '.env'), 'TARUVI_SITE_URL=https://intended.taruvi.cloud\nTARUVI_APP_SLUG=intended\nTARUVI_API_KEY=fixture-token\n');
  const config = { mcpServers: { taruvi: { type: 'http', url: 'https://intended.taruvi.cloud/mcp/', headers: { Authorization: 'Api-Key fixture-token', 'X-App-Slug': 'intended' }, disabled: false } } };
  const save = () => fs.writeFileSync(path.join(root, '.kiro/settings/mcp.json'), JSON.stringify(config)); save();
  const run = (event = { tool_name: 'mcp_taruvi_manage_function', session_id: 's1' }, args = [], executable = script) => spawnSync('python3', [executable, ...args], { cwd: root, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, input: event ? JSON.stringify(event) : '', encoding: 'utf8', timeout: 10000 });
  const record = (session = 's1', site = 'https://intended.taruvi.cloud') => run(null, ['--record', '--session-id', session, '--observed-site-url', site, '--observed-app-slug', 'intended']);
  return { root, config, save, run, record };
}
test('requires live attestation for mutations, permits only explicit read probes first', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 2);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_get_datatable_schema', session_id: 's1' }).status, 0);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_execute_raw_sql', session_id: 's1' }).status, 2);
  assert.equal(f.record().status, 0); assert.equal(f.run().status, 0);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_manage_function', session_id: 's2' }).status, 2);
  assert.equal(f.record('s2').status, 0);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_manage_function', session_id: 's2' }).status, 0);
});
test('wrong live scope and parameter overrides cannot be recorded or used', t => {
  const f = fixture(t); assert.equal(f.record('s1', 'https://other.taruvi.cloud').status, 2);
  assert.equal(f.record().status, 0);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_manage_function', session_id: 's1', tool_input: { app_slug: 'wrong' } }).status, 2);
});
for (const [label, mutate] of [
  ['disabled', s => { s.disabled = true; }],
  ['wrong tenant', s => { s.url = 'https://other.taruvi.cloud/mcp/'; }],
  ['lookalike tenant origin', s => { s.url = 'https://intended.attacker.example/mcp/'; }],
  ['wrong app', s => { s.headers['X-App-Slug'] = 'wrong'; }],
  ['placeholder key', s => { s.headers.Authorization = 'Api-Key <your-api-key>'; }],
  ['wrong key', s => { s.headers.Authorization = 'Api-Key other-key'; }],
  ['invalid headers', s => { s.headers = []; }],
  ['URL query', s => { s.url += '?redirect=other'; }],
]) test(`blocks ${label}, including on read probes and setup checks`, t => {
  const f = fixture(t); mutate(f.config.mcpServers.taruvi); f.save();
  const r = f.run({ tool_name: 'mcp_taruvi_get_datatable_schema', session_id: 's1' }, ['--quiet']);
  assert.equal(r.status, 2); assert.ok(r.stderr); assert.ok(!r.stderr.includes('fixture-token'));
  assert.equal(f.run(null, [], checker).status, 1);
});
test('resolves actual server names, rejects inherited/unqualified/ambiguous IDs', t => {
  const f = fixture(t); f.config.mcpServers['taruvi-stage'] = f.config.mcpServers.taruvi; f.save();
  assert.equal(f.run({ tool_name: 'mcp_taruvi_stage_get_datatable_schema', session_id: 's1' }).status, 2); // ambiguous taruvi vs taruvi-stage
  delete f.config.mcpServers.taruvi; f.save();
  assert.equal(f.run({ tool_name: 'mcp_taruvi_stage_get_datatable_schema', session_id: 's1' }).status, 0);
  assert.equal(f.run({ tool_name: 'mcp_inherited_get_datatable_schema', session_id: 's1' }).status, 2);
  assert.equal(f.run({ tool_name: 'get_datatable_schema', session_id: 's1' }).status, 2);
});
test('changed credentials and missing session invalidate confirmation', t => {
  const f = fixture(t); assert.equal(f.record().status, 0);
  f.config.mcpServers.taruvi.headers.Authorization = 'Api-Key rotated'; f.save();
  fs.writeFileSync(path.join(f.root, '.env'), 'TARUVI_SITE_URL=https://intended.taruvi.cloud\nTARUVI_APP_SLUG=intended\nTARUVI_API_KEY=rotated\n');
  assert.equal(f.run().status, 2);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_get_datatable_schema' }).status, 2);
});
test('malformed config and old confirmation records fail closed without tracebacks', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, '.kiro/.taruvi-mcp-confirmed'), 'oldhash\n');
  assert.equal(f.run().status, 2);
  fs.writeFileSync(path.join(f.root, '.kiro/settings/mcp.json'), '[]');
  const r = f.run(); assert.equal(r.status, 2); assert.doesNotMatch(r.stderr, /Traceback/);
});

function oauthFixture(t) {
  const f = fixture(t);
  f.config.mcpServers.taruvi = { type: 'http', url: 'https://mcp.taruvibase.com/mcp?siteId=workspace&appId=intended' };
  f.save();
  fs.writeFileSync(path.join(f.root, '.env'), 'TARUVI_SITE_URL=https://intended.taruvi.cloud\nTARUVI_SITE_SLUG=workspace\nTARUVI_APP_SLUG=intended\n');
  f.record = () => f.run(null, ['--record', '--session-id', 's1', '--observed-site-url', 'https://intended.taruvi.cloud', '--observed-site-slug', 'workspace', '--observed-app-slug', 'intended']);
  return f;
}
test('OAuth permits site/app probes without runtime API keys and requires attestation for writes', t => {
  const f = oauthFixture(t);
  const event = name => ({ tool_name: `mcp_taruvi_${name}`, session_id: 's1' });
  assert.equal(f.run(null, [], checker).status, 0);
  assert.equal(f.run(null, ['--record', '--session-id', 's1', '--observed-site-url', 'https://intended.taruvi.cloud', '--observed-app-slug', 'intended']).status, 2);
  for (const name of ['get_sites', 'get_apps']) assert.equal(f.run(event(name)).status, 0);
  for (const name of ['save_tables', 'get_datatable_schema', 'get_ai_docs']) assert.equal(f.run(event(name)).status, 2);
  assert.equal(f.record().status, 0);
  assert.equal(f.run(event('save_tables')).status, 0);
  for (const tool_input of [{site_id: 'other'}, {app_id: 'other'}, {site_ids: ['workspace', 'other']}, {app_ids: ['other']}]) {
    assert.equal(f.run({...event('get_sites'), tool_input}).status, 2);
  }
  f.config.mcpServers.taruvi.url += '&readonly=true'; f.save();
  assert.equal(f.run(event('save_tables')).status, 2);
});
for (const [label, mutate] of [
  ['unscoped', s => { s.url = 'https://mcp.taruvibase.com/mcp'; }],
  ['app-only', s => { s.url = 'https://mcp.taruvibase.com/mcp?appId=intended'; }],
  ['wrong site', s => { s.url = s.url.replace('workspace', 'wrong'); }],
  ['duplicate site', s => { s.url += '&siteId=workspace'; }],
  ['duplicate app', s => { s.url += '&appId=intended'; }],
  ['unknown query', s => { s.url += '&token=fixture'; }],
  ['fragment', s => { s.url += '#fragment'; }],
  ['credentials', s => { s.url = s.url.replace('https://', 'https://user@'); }],
  ['legacy headers', s => { s.headers = {Authorization: 'Api-Key fixture'}; }],
  ['wrong port', s => { s.url = s.url.replace('.com/', '.com:444/'); }],
  ['bad identifier', s => { s.url = s.url.replace('workspace', '..'); }],
  ['bad readonly', s => { s.url += '&readonly=yes'; }],
  ['unknown category', s => { s.url += '&category=unknown'; }],
  ['lookalike host', s => { s.url = s.url.replace('mcp.taruvibase.com', 'mcp.taruvibase.com.evil.example'); }],
]) test(`OAuth rejects ${label} even before live reads`, t => {
  const f = oauthFixture(t); mutate(f.config.mcpServers.taruvi); f.save();
  const r = f.run({tool_name: 'mcp_taruvi_get_sites', session_id: 's1'});
  assert.equal(r.status, 2); assert.doesNotMatch(r.stderr, /Traceback|Api-Key fixture/);
});
test('OAuth supports the test Worker and invalidates evidence after local scope metadata changes', t => {
  const f = oauthFixture(t);
  f.config.mcpServers.taruvi.url = f.config.mcpServers.taruvi.url.replace('mcp.taruvibase', 'test-mcp.taruvibase'); f.save();
  assert.equal(f.record().status, 0);
  fs.appendFileSync(path.join(f.root, '.env'), 'TARUVI_SITE_URL=https://different.example\n');
  assert.equal(f.run().status, 2);
});

test('Console URL alone configures OAuth without env, runtime domain, or API key', t => {
  const f = oauthFixture(t);
  fs.unlinkSync(path.join(f.root, '.env'));
  f.config.mcpServers.taruvi.url = 'https://test-mcp.taruvibase.com/mcp?siteId=test-prompts&appId=plugin-test';
  f.save();
  const check = f.run(null, [], checker);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /test-prompts \/ plugin-test/);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_get_sites', session_id: 's1' }).status, 0);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_save_tables', session_id: 's1' }).status, 2);
  const record = f.run(null, ['--record', '--session-id', 's1', '--observed-site-slug', 'test-prompts', '--observed-app-slug', 'plugin-test']);
  assert.equal(record.status, 0, record.stderr);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_save_tables', session_id: 's1' }).status, 0);
  assert.equal(f.run({ tool_name: 'mcp_taruvi_get_apps', session_id: 's1', tool_input: {site_id: 'wrong'} }).status, 2);
  fs.writeFileSync(path.join(f.root, '.env'), 'TARUVI_APP_SLUG=other-app\n');
  assert.equal(f.run(null, [], checker).status, 1);
});
test('Console URL scope decoding preserves filters and requires matching observed slugs', t => {
  const f = oauthFixture(t);
  fs.unlinkSync(path.join(f.root, '.env'));
  f.config.mcpServers.taruvi.url = 'https://mcp.taruvibase.com/mcp?siteId=my%2Dsite&appId=my%2Dapp&readonly=true&category=sites,apps&category=schema';
  f.save();
  assert.equal(f.run(null, [], checker).status, 0);
  for (const site of ['wrong', 'my-site']) {
    const r = f.run(null, ['--record', '--session-id', 's1', '--observed-site-slug', site, '--observed-app-slug', 'my-app']);
    assert.equal(r.status, site === 'my-site' ? 0 : 2, r.stderr);
  }
  f.config.mcpServers.taruvi.url += '&appId=other'; f.save();
  assert.equal(f.run(null, [], checker).status, 1);
});
