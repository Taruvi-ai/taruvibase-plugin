import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function snapshot() {
  const entries = {};
  function visit(relative) {
    const target = path.join(root, relative);
    if (!fs.existsSync(target)) return;
    const stats = fs.lstatSync(target);
    if (stats.isSymbolicLink()) entries[relative] = `link:${fs.readlinkSync(target)}`;
    else if (stats.isDirectory()) for (const name of fs.readdirSync(target).sort()) visit(path.join(relative, name));
    else entries[relative] = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  }
  for (const folder of ['skills', 'payload']) visit(folder);
  return entries;
}
const before = snapshot();
const result = spawnSync('bash', ['scripts/build-vendor-files.sh'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const after = snapshot();
const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => before[k] !== after[k]);
if (changed.length) { console.error('Generated files were stale:\n' + changed.join('\n')); process.exit(1); }
console.log('Generated files match canonical sources.');
