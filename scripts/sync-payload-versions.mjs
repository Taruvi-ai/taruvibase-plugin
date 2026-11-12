import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
for (const relative of ['.claude/.claude-plugin/plugin.json', '.codex/.codex-plugin/plugin.json', '.cursor/.cursor-plugin/plugin.json', '.kiro/plugin.json']) {
  const file = path.join(root, 'payload', relative);
  const value = JSON.parse(fs.readFileSync(file));
  value.version = version;
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
