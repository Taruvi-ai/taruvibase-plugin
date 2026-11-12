import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'taruvi-packed-'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  run('npm', ['pack', '--pack-destination', temp, '--cache', path.join(temp, 'npm-cache')]);
  const archive = fs.readdirSync(temp).find(f => f.endsWith('.tgz'));
  run('tar', ['-xzf', path.join(temp, archive), '-C', temp]);
  const extracted = path.join(temp, 'package');
  // Use the lockfile-installed validation dependencies; the archive's code and
  // schemas are tested in place, without relying on its source checkout.
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(extracted, 'node_modules'), 'dir');
  for (const file of ['validate-agent-plugin.mjs', 'validate-vendor-files.mjs']) run(process.execPath, [`scripts/${file}`], extracted);
  const target = path.join(temp, 'project');
  run(process.execPath, ['bin/taruvi-agents-plugin.js', 'install', '--target', target, '--allow-non-template'], extracted);
  if (!fs.existsSync(path.join(target, '.agents/skills/codex-setup/SKILL.md'))) throw new Error('Installed archive lacks discoverable Codex setup skill');
  for (const vendor of ['claude', 'codex', 'cursor', 'kiro']) {
    const isolated = path.join(temp, vendor);
    fs.cpSync(path.join(extracted, 'payload', `.${vendor}`), isolated, { recursive: true });
    for (const skill of ['taruvi-app-developer', 'taruvi-refine-providers', `${vendor}-setup`]) {
      if (!fs.existsSync(path.join(isolated, 'skills', skill, 'SKILL.md'))) throw new Error(`${vendor}: missing ${skill}`);
    }
  }
  console.log('Packed archive validation, installation and independent vendor copies passed.');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
