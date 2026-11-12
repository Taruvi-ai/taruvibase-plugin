#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const payloadRoot = path.join(packageRoot, 'payload');
const vendors = ['.agents', '.claude', '.codex', '.cursor', '.kiro'];
const runtimePaths = new Set(['.claude/.mcp.json', '.codex/.mcp.json', '.cursor/mcp.json', '.kiro/mcp.json']);
const ignores = ['.env', '.env.local', '.mcp.json', '.claude/.mcp.json', '.codex/.mcp.json', '.codex/config.toml', '.codex/log/', '.cursor/mcp.json', '.kiro/settings/mcp.json', '.kiro/.taruvi-mcp-confirmed', '.taruvi-agents-plugin/'];
const stateDir = '.taruvi-agents-plugin';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const stat = p => { try { return fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };

function usage() {
  console.log('Usage: taruvi-agents-plugin install [--target <dir>] [--force] [--allow-non-template]\nExisting MCP configuration is always preserved. --force backs up and replaces modified support files.');
}
function parseArgs() {
  const args = { target: process.cwd(), force: false, allowNonTemplate: false };
  const argv = process.argv.slice(2);
  if (!argv.length || ['--help', '-h'].includes(argv[0])) { usage(); return null; }
  if (argv.shift() !== 'install') throw new Error('Expected install command');
  while (argv.length) {
    const option = argv.shift();
    if (option === '--target') {
      if (!argv.length || argv[0].startsWith('--')) throw new Error('--target requires a directory');
      args.target = path.resolve(argv.shift());
    } else if (option === '--force') args.force = true;
    else if (option === '--allow-non-template') args.allowNonTemplate = true;
    else if (['--help', '-h'].includes(option)) { usage(); return null; }
    else throw new Error(`Unknown argument: ${option}`);
  }
  return args;
}
function assertSafeAncestors(root, relative) {
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (stat(current)?.isSymbolicLink()) throw new Error(`Refusing destination symlink: ${path.relative(root, current)}`);
  }
}
function legacyTarget(relative) {
  const match = relative.match(/^\.(claude|codex|cursor|kiro)\/skills\/(taruvi-app-developer|taruvi-refine-providers|context7-mcp)$/);
  if (match) return match[2] === 'context7-mcp' ? '../../.codex/skills/context7-mcp' : `../../.agents/skills/${match[2]}`;
  if (relative === '.kiro/scripts') return '../.agents/hooks/taruvi';
  return null;
}
// Snapshot before updating .codex: the legacy Kiro directory shares its contents.
// Resolve contained support links into real files, rejecting escapes and cycles.
function snapshotSkills(root, directory) {
  const entries = new Map();
  function walk(source, relative, ancestors = new Set()) {
    let resolved;
    try { resolved = fs.realpathSync(source); }
    catch { throw new Error(`Cannot migrate legacy Kiro skills: missing or broken link at ${relative || '.'}`); }
    const within = path.relative(root, resolved);
    if (within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within)) {
      throw new Error(`Cannot migrate legacy Kiro skills: link escapes project at ${relative || '.'}`);
    }
    const info = fs.statSync(resolved);
    if (info.isDirectory()) {
      if (ancestors.has(resolved)) throw new Error(`Cannot migrate legacy Kiro skills: link cycle at ${relative}`);
      entries.set(relative, { directory: true, mode: info.mode & 0o777 });
      const next = new Set(ancestors).add(resolved);
      for (const name of fs.readdirSync(resolved)) walk(path.join(resolved, name), path.join(relative, name), next);
    } else if (info.isFile()) {
      entries.set(relative, { directory: false, mode: info.mode & 0o777, content: fs.readFileSync(resolved) });
    } else throw new Error(`Cannot migrate legacy Kiro skills: unsupported file at ${relative}`);
  }
  walk(directory, '');
  if (!entries.get('').directory) throw new Error('Legacy Kiro skills must point to a directory');
  return entries;
}
function install(args) {
  let root = path.resolve(args.target);
  if (stat(root)?.isSymbolicLink()) throw new Error('Target must not be a symlink');
  // Canonicalize OS aliases such as macOS /tmp -> /private/tmp. Plugin-owned
  // destination paths below this root are still checked independently.
  let ancestor = root;
  while (!stat(ancestor)) ancestor = path.dirname(ancestor);
  root = path.join(fs.realpathSync(ancestor), path.relative(ancestor, root));
  const missing = ['package.json', 'src/taruviClient.ts', 'AGENTS.md', 'UI_Guidelines.md'].filter(p => !fs.existsSync(path.join(root, p)));
  if (missing.length && !args.allowNonTemplate) throw new Error(`Target is not a Taruvi template. Missing: ${missing.join(', ')}. Use --allow-non-template explicitly.`);
  if (!fs.existsSync(payloadRoot)) throw new Error('Installer payload is missing. Rebuild the package before installing.');
  for (const file of ['.kiro/settings/mcp.json', '.codex/config.toml', '.codex/log/codex-tui.log']) {
    if (fs.existsSync(path.join(payloadRoot, file))) throw new Error(`Runtime file in payload: ${file}`);
  }
  assertSafeAncestors(root, stateDir);
  assertSafeAncestors(root, '.gitignore');
  assertSafeAncestors(root, `${stateDir}/state.json`);
  const stateFile = path.join(root, stateDir, 'state.json');
  const previous = stat(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { files: {} };
  if (!previous.files || typeof previous.files !== 'object' || Array.isArray(previous.files)) throw new Error('Invalid installer state');
  const planned = [], links = [], conflicts = [], preserved = [];
  const files = {};
  const kiroSkills = path.join('.kiro', 'skills');
  const kiroPath = path.join(root, kiroSkills);
  assertSafeAncestors(root, '.kiro');
  const migration = stat(kiroPath)?.isSymbolicLink() && fs.readlinkSync(kiroPath) === '../.codex/skills'
    ? snapshotSkills(root, kiroPath) : null;
  const inMigration = relative => migration && (relative === kiroSkills || relative.startsWith(kiroSkills + path.sep));
  function visit(relative, replacingLink = false) {
    const source = path.join(payloadRoot, relative), destination = path.join(root, relative);
    const sourceStat = fs.lstatSync(source);
    if (sourceStat.isSymbolicLink()) throw new Error(`Payload must be self-contained without symlinks: ${relative}`);
    const inherited = inMigration(relative) ? migration.get(path.relative(kiroSkills, relative)) : null;
    let existing = inMigration(relative)
      ? (inherited ? { isSymbolicLink: () => false, isDirectory: () => inherited.directory, isFile: () => !inherited.directory } : null)
      : replacingLink ? null : stat(destination);
    if (existing?.isSymbolicLink()) {
      // Migrate only the exact links emitted by older installer releases.
      if (sourceStat.isDirectory() && fs.readlinkSync(destination) === legacyTarget(relative)) {
        links.push(relative); existing = null; replacingLink = true;
      } else throw new Error(`Refusing destination symlink: ${relative}`);
    }
    if (sourceStat.isDirectory()) {
      if (existing && !existing.isDirectory()) throw new Error(`Expected directory: ${relative}`);
      for (const name of fs.readdirSync(source)) visit(path.join(relative, name), replacingLink);
      return;
    }
    if (existing && !existing.isFile()) throw new Error(`Expected regular file: ${relative}`);
    if (existing && runtimePaths.has(relative)) { preserved.push(relative); return; }
    const content = fs.readFileSync(source), digest = hash(content);
    if (!runtimePaths.has(relative)) files[relative] = digest;
    const existingHash = existing ? hash(inherited ? inherited.content : fs.readFileSync(destination)) : null;
    if (existingHash === digest) return;
    const modified = existing && existingHash !== previous.files[relative];
    if (modified && !args.force) conflicts.push(relative);
    planned.push({ relative, content, mode: sourceStat.mode & 0o777, backup: Boolean(modified), backupContent: modified && inherited ? inherited.content : null });
  }
  for (const vendor of vendors) visit(vendor);
  if (conflicts.length) throw new Error(`Modified or unmanaged files would be overwritten:\n${conflicts.join('\n')}\nReview them, then use --force to back them up and replace them. MCP configuration is always preserved.`);

  // All destination conflicts have been checked before any writes.
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, stateDir), { recursive: true, mode: 0o700 });
  const existingIgnore = stat(path.join(root, '.gitignore')) ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  const present = new Set(existingIgnore.split(/\r?\n/).map(s => s.trim()));
  const additions = ignores.filter(s => !present.has(s));
  if (additions.length) fs.writeFileSync(path.join(root, '.gitignore'), existingIgnore + (existingIgnore && !existingIgnore.endsWith('\n') ? '\n' : '') + '\n# Taruvi local configuration and installer backups\n' + additions.join('\n') + '\n');
  let backupDir;
  if (planned.some(p => p.backup)) {
    backupDir = fs.mkdtempSync(path.join(root, stateDir, 'backup-'));
    fs.chmodSync(backupDir, 0o700);
    for (const item of planned.filter(p => p.backup)) {
      const target = path.join(backupDir, item.relative);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      if (item.backupContent) fs.writeFileSync(target, item.backupContent);
      else fs.copyFileSync(path.join(root, item.relative), target);
      fs.chmodSync(target, 0o600);
    }
  }
  // Build a complete replacement before removing the old directory link.
  let stagedSkills;
  if (migration) {
    stagedSkills = fs.mkdtempSync(path.join(root, stateDir, 'kiro-skills-'));
    for (const [relative, entry] of migration) {
      const target = path.join(stagedSkills, relative);
      if (entry.directory) fs.mkdirSync(target, { recursive: true });
      else fs.writeFileSync(target, entry.content, { mode: entry.mode });
    }
    for (const item of planned.filter(item => inMigration(item.relative))) {
      const target = path.join(stagedSkills, path.relative(kiroSkills, item.relative));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, item.content, { mode: item.mode });
    }
  }
  for (const relative of links) fs.unlinkSync(path.join(root, relative));
  for (const item of planned) {
    if (inMigration(item.relative)) continue;
    const target = path.join(root, item.relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.taruvi-${crypto.randomUUID()}`;
    fs.writeFileSync(temp, item.content, { mode: item.mode, flag: 'wx' });
    fs.renameSync(temp, target);
  }
  if (migration) {
    fs.unlinkSync(kiroPath);
    try { fs.renameSync(stagedSkills, kiroPath); }
    catch (error) {
      fs.symlinkSync('../.codex/skills', kiroPath);
      throw error;
    }
    console.log('Migrated .kiro/skills to a real directory, preserving existing skills.');
  }
  const tempState = `${stateFile}.${crypto.randomUUID()}`;
  fs.writeFileSync(tempState, JSON.stringify({ version: 1, files }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.renameSync(tempState, stateFile);
  console.log(`Taruvi agent support installed in ${root}.`);
  if (preserved.length) console.log(`Preserved existing MCP configuration: ${preserved.join(', ')}`);
  if (backupDir) console.log(`Backups: ${backupDir}`);
  console.log('Next: open your agent and say: setup taruvi. See the vendor README for plugin activation.');
}
try { const args = parseArgs(); if (args) install(args); }
catch (e) { console.error(e.message); process.exitCode = 1; }
