import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateHeaderName, validateHeaderValue } from 'node:http';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateSkillContent } from './skill-frontmatter.mjs';

const schemaRoot = fileURLToPath(new URL('../../schemas/agent-plugins/1.0.0/', import.meta.url));
const ajv = new Ajv2020({ allErrors: true });
const validators = Object.fromEntries(['plugin', 'mcp'].map(name => [name, ajv.compile(JSON.parse(fs.readFileSync(path.join(schemaRoot, `${name}.schema.json`), 'utf8')))]));
export function schemaErrors(name, value) {
  const validate = validators[name];
  return validate(value) ? [] : validate.errors.map(e => `${name}.json${e.instancePath}: ${e.message}`);
}
export function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export function checkPath(root, relative) {
  const realRoot = fs.realpathSync(root);
  const target = path.resolve(root, relative);
  if (!contained(path.resolve(root), target) || !contained(realRoot, fs.realpathSync(target))) throw new Error(`${relative}: path escapes plugin root`);
  return target;
}
// Inspect every bundled support file, not only SKILL.md. Detect symlink cycles.
export function inspectTree(root, relative, ancestors = new Set()) {
  const target = checkPath(root, relative);
  const real = fs.realpathSync(target);
  if (ancestors.has(real)) throw new Error(`${relative}: symlink cycle`);
  if (!fs.statSync(target).isDirectory()) return;
  const next = new Set([...ancestors, real]);
  for (const entry of fs.readdirSync(target)) inspectTree(root, path.join(relative, entry), next);
}
export function validateSkillTree(root) {
  const errors = [];
  const dir = path.join(root, 'skills');
  if (!fs.existsSync(dir)) return errors;
  try {
    inspectTree(root, 'skills');
    for (const name of fs.readdirSync(dir)) {
      if (!fs.statSync(path.join(dir, name)).isDirectory()) continue;
      const file = checkPath(root, `skills/${name}/SKILL.md`);
      errors.push(...validateSkillContent({ content: fs.readFileSync(file, 'utf8'), label: file, expectedName: name }));
    }
  } catch (e) { errors.push(e.message); }
  return errors;
}
export function validatePortable(root) {
  const errors = [];
  for (const name of ['plugin', 'mcp']) {
    if (name === 'mcp' && !fs.existsSync(path.join(root, 'mcp.json'))) continue;
    try {
      const file = checkPath(root, `${name}.json`);
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      const invalid = schemaErrors(name, value);
      errors.push(...invalid);
      if (invalid.length || name !== 'mcp') continue;
      for (const [serverName, s] of Object.entries(value.mcpServers)) {
        try {
          if (s.type === 'stdio') {
            if (s.command.startsWith('./')) {
              if (!fs.statSync(checkPath(root, s.command)).isFile()) throw new Error('command must be a file');
            } else if (!s.command || /[\s/\\:$`;&|<>]/.test(s.command)) throw new Error('command must be a bare executable or ./ path');
            if (s.cwd !== undefined) {
              if (s.cwd.startsWith('${PLUGIN_DATA}')) {
                // The runtime owns this directory; verify lexical containment here.
                const suffix = s.cwd.slice('${PLUGIN_DATA}'.length);
                const data = path.resolve(root, '__plugin_data__');
                if (/[\\$]/.test(suffix) || !contained(data, path.resolve(data, `.${suffix}`))) throw new Error('cwd escapes PLUGIN_DATA');
              } else {
                const cwd = s.cwd.replaceAll('${PLUGIN_ROOT}', path.resolve(root));
                if (cwd.includes('${') || !fs.statSync(checkPath(root, cwd)).isDirectory()) throw new Error('invalid cwd');
              }
            }
          } else {
            if (s.url.includes('${')) throw new Error('URL placeholders are not portable');
            const u = new URL(s.url);
            const loopback = u.hostname === 'localhost' || u.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(u.hostname);
            if (!['http:', 'https:'].includes(u.protocol) || (u.protocol === 'http:' && !loopback) || u.username || u.password || s.url.includes('#')) throw new Error('invalid or insecure HTTP URL');
            const seen = new Set();
            for (const [key, val] of Object.entries(s.headers ?? {})) {
              validateHeaderName(key); validateHeaderValue(key, val);
              if (seen.has(key.toLowerCase())) throw new Error('duplicate case-insensitive header');
              seen.add(key.toLowerCase());
            }
          }
        } catch (e) { errors.push(`mcp server ${serverName}: ${e.message}`); }
      }
    } catch (e) { errors.push(`${name}.json: ${e.message}`); }
  }
  errors.push(...validateSkillTree(root));
  return errors;
}
