#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { inspectTree, validatePortable, validateSkillTree, checkPath } from './lib/conformance.mjs';
import { validateSkillContent } from "./lib/skill-frontmatter.mjs";

const root = path.resolve(process.argv[2] ?? process.cwd());
const errors = [];

const rel = (...parts) => path.join(...parts);
const abs = (...parts) => path.join(root, ...parts);

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(abs(relativePath), "utf8"));
  } catch (error) {
    fail(`${relativePath}: ${error.message}`);
    return undefined;
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
    return false;
  }
  return true;
}

function assertPathField(manifest, basePath, pluginRoot, fieldName) {
  const value = manifest[fieldName];
  if (value === undefined) return;
  if (typeof value !== "string" || !value.startsWith("./")) {
    fail(`${basePath} ${fieldName} must be a plugin-root-relative path starting with ./`);
    return;
  }
  let target;
  try { target = checkPath(abs(pluginRoot), value); }
  catch (error) { fail(`${basePath} ${fieldName}: ${error.message}`); return; }
  if (!fs.existsSync(target)) {
    fail(`${basePath} ${fieldName} points to missing path ${value}`);
  }
}

// Validate the native server fields used by these adapters. These are not the
// portable MCP schema: native clients allow their own transport/variable forms.
function validateNativeMcp(config, label, { bare = false, httpType = false, siteVariable = false } = {}) {
  const servers = bare ? config : config.mcpServers;
  if (!assertObject(servers, `${label} servers`)) return;
  for (const [name, server] of Object.entries(servers)) {
    if (!assertObject(server, `${label} ${name}`)) continue;
    if (server.url !== undefined) {
      if (typeof server.url !== 'string' || !(server.url.startsWith('https://') || (siteVariable && server.url.startsWith('${TARUVI_SITE_URL}/')))) fail(`${label} ${name}: expected HTTPS URL template`);
      if (httpType && server.type !== 'http') fail(`${label} ${name}: expected native http type`);
    } else if (typeof server.command !== 'string' || !server.command) fail(`${label} ${name}: command or URL required`);
    if (server.args !== undefined && (!Array.isArray(server.args) || server.args.some(v => typeof v !== 'string'))) fail(`${label} ${name}: args must be strings`);
    for (const key of ['env', 'headers']) {
      if (server[key] !== undefined && (!assertObject(server[key], `${label} ${name}.${key}`) || Object.values(server[key]).some(v => typeof v !== 'string'))) fail(`${label} ${name}: ${key} values must be strings`);
    }
  }
}

function validateOAuthPackages() {
  for (const [file, bare, type] of [
    ['mcp.json', false, 'streamable-http'],
    ['payload/.kiro/mcp.json', false, 'streamable-http'],
    ['payload/.claude/.mcp.json', false, 'http'],
    ['payload/.cursor/mcp.json', false, undefined],
    ['payload/.codex/.mcp.json', true, undefined],
    ['payload/.kiro/workspace-mcp.example.json', false, 'http'],
  ]) {
    const config = readJson(file);
    const server = (bare ? config : config?.mcpServers)?.taruvi;
    if (!server || server.url !== 'https://mcp.taruvibase.com/mcp' || server.type !== type ||
        Object.keys(server).some(key => !['url', 'type', 'disabled', 'autoApprove'].includes(key))) {
      fail(`${file}: bundled Taruvi must use the secret-free OAuth endpoint and native/portable transport`);
    }
  }
}

function validateCursor() {
  const manifestPath = rel("payload", ".cursor", ".cursor-plugin", "plugin.json");
  const pluginRoot = rel("payload", ".cursor");
  const mcpPath = rel("payload", ".cursor", "mcp.json");
  const manifest = readJson(manifestPath);
  const mcp = readJson(mcpPath);
  if (!assertObject(manifest, manifestPath) || !assertObject(mcp, mcpPath)) return;

  for (const field of ["skills", "rules", "agents", "commands", "mcpServers"]) {
    assertPathField(manifest, manifestPath, pluginRoot, field);
  }

  validateNativeMcp(mcp, mcpPath);
  if (!assertObject(manifest.variables, `${manifestPath} variables`)) return;
  if (!assertObject(manifest.variables.properties, `${manifestPath} variables.properties`)) return;

  if (manifest.variables.type !== 'object') fail(`${manifestPath}: variables.type must be object`);
  for (const key of manifest.variables.required ?? []) if (!manifest.variables.properties[key]) fail(`${manifestPath}: undeclared required variable ${key}`);
  const rawMcp = fs.readFileSync(abs(mcpPath), "utf8");
  const placeholders = new Set([...rawMcp.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((match) => match[1]));
  for (const name of placeholders) {
    if (!manifest.variables.properties[name]) {
      fail(`${mcpPath} uses ${name}, but ${manifestPath} does not declare it in variables.properties`);
    }
  }
}

function validateClaude() {
  const manifestPath = rel("payload", ".claude", ".claude-plugin", "plugin.json");
  const pluginRoot = rel("payload", ".claude");
  const mcpPath = rel("payload", ".claude", ".mcp.json");
  const manifest = readJson(manifestPath);
  const mcp = readJson(mcpPath);
  if (!assertObject(manifest, manifestPath) || !assertObject(mcp, mcpPath)) return;

  assertPathField(manifest, manifestPath, pluginRoot, "mcpServers");
  validateNativeMcp(mcp, mcpPath, { httpType: true });
  if (!assertObject(manifest.userConfig, `${manifestPath} userConfig`)) return;

  for (const [name, config] of Object.entries(manifest.userConfig)) {
    if (!assertObject(config, `${manifestPath} ${name}`)) continue;
    for (const field of ['type', 'title', 'description']) if (typeof config[field] !== 'string') fail(`${manifestPath} ${name}.${field}: string required`);
    if (name.endsWith('api_key') && config.sensitive !== true) fail(`${manifestPath} ${name}: sensitive must be true`);
  }
  const rawMcp = fs.readFileSync(abs(mcpPath), "utf8");
  const placeholders = new Set([...rawMcp.matchAll(/\$\{user_config\.([a-z0-9_]+)\}/g)].map((match) => match[1]));
  for (const name of placeholders) {
    if (!manifest.userConfig[name]) {
      fail(`${mcpPath} uses user_config.${name}, but ${manifestPath} does not declare it in userConfig`);
    }
  }
}

function validateCodex() {
  const manifestPath = rel("payload", ".codex", ".codex-plugin", "plugin.json");
  const pluginRoot = rel("payload", ".codex");
  const mcpPath = rel("payload", ".codex", ".mcp.json");
  const manifest = readJson(manifestPath);
  const mcp = readJson(mcpPath);
  if (!assertObject(manifest, manifestPath) || !assertObject(mcp, mcpPath)) return;

  for (const field of ["skills", "mcpServers"]) {
    assertPathField(manifest, manifestPath, pluginRoot, field);
  }

  validateNativeMcp(mcp, mcpPath, { bare: !mcp.mcpServers });
  if (JSON.stringify(mcp).includes("TARUVI_") || JSON.stringify(mcp).includes("user_config.taruvi")) {
    fail(`${mcpPath} must stay secret-free; Taruvi MCP belongs in Codex config.toml.`);
  }
}

function validateKiroHooks() {
  const hooksDir = abs("payload", ".kiro", "hooks");
  const allowedTriggers = new Set([
    "PostFileSave",
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "SessionStart",
    "SessionEnd",
  ]);

  for (const fileName of fs.readdirSync(hooksDir).filter((name) => name.endsWith(".json")).sort()) {
    const hookPath = rel("payload", ".kiro", "hooks", fileName);
    const config = readJson(hookPath);
    if (!assertObject(config, hookPath)) continue;
    if (config.version !== "v1") {
      fail(`${hookPath} must use Kiro hook schema version v1.`);
    }
    if (!Array.isArray(config.hooks) || config.hooks.length === 0) {
      fail(`${hookPath} must contain a non-empty hooks array.`);
      continue;
    }
    for (const [index, hook] of config.hooks.entries()) {
      const label = `${hookPath} hooks[${index}]`;
      if (!assertObject(hook, label)) continue;
      if (typeof hook.name !== "string" || hook.name.length === 0) {
        fail(`${label}.name must be a non-empty string.`);
      }
      if (!allowedTriggers.has(hook.trigger)) {
        fail(`${label}.trigger must be one of ${[...allowedTriggers].join(", ")}.`);
      }
      if (hook.matcher !== undefined) {
        try {
          new RegExp(hook.matcher);
        } catch (error) {
          fail(`${label}.matcher is not a valid regular expression: ${error.message}`);
        }
      }
      if (!assertObject(hook.action, `${label}.action`)) continue;
      if (!["agent", "command"].includes(hook.action.type)) {
        fail(`${label}.action.type must be agent or command.`);
      }
      if (hook.action.type === "agent" && typeof hook.action.prompt !== "string") {
        fail(`${label}.action.prompt must be a string for agent actions.`);
      }
      if (hook.action.type === "command" && typeof hook.action.command !== "string") {
        fail(`${label}.action.command must be a string for command actions.`);
      }
    }
  }
}

// Validate the extracted artifact, not just src/. Generated setup skills only
// exist in payload/, so this is the gate that has to catch broken frontmatter.
function findSkillFiles(startDir) {
  const found = [];
  if (!fs.existsSync(startDir)) return found;

  const stack = [startDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        found.push(entryPath);
      }
    }
  }
  return found.sort();
}

function validatePayloadSkills() {
  const payloadDir = abs("payload");
  if (!fs.existsSync(payloadDir)) {
    fail("payload/ is missing. Run npm run build:vendor-files before validating.");
    return;
  }

  const skillFiles = findSkillFiles(payloadDir);
  if (skillFiles.length === 0) {
    fail("payload/ contains no SKILL.md files.");
    return;
  }

  for (const skillFile of skillFiles) {
    const label = path.relative(root, skillFile);
    for (const error of validateSkillContent({
      content: fs.readFileSync(skillFile, "utf8"),
      label,
      expectedName: path.basename(path.dirname(skillFile)),
    })) {
      fail(error);
    }
  }
}

function validateSelfContainedPackages() {
  const version = readJson('package.json')?.version;
  for (const vendor of ['claude', 'codex', 'cursor', 'kiro']) {
    const vendorRoot = abs('payload', `.${vendor}`);
    try {
      for (const entry of fs.readdirSync(vendorRoot)) inspectTree(vendorRoot, entry);
      for (const skill of ['taruvi-app-developer', 'taruvi-refine-providers', `${vendor}-setup`, 'context7-mcp']) {
        checkPath(vendorRoot, `skills/${skill}/SKILL.md`);
      }
      errors.push(...validateSkillTree(vendorRoot));
      const manifestPath = vendor === 'kiro' ? 'plugin.json' : `.${vendor}-plugin/plugin.json`;
      const manifest = JSON.parse(fs.readFileSync(checkPath(vendorRoot, manifestPath), 'utf8'));
      if (manifest.version !== version) fail(`${vendor}: version differs from package.json`);
      if (vendor === 'kiro') {
        errors.push(...validatePortable(vendorRoot));
        for (const script of ['config_check.py', 'mcp_scope.py', 'check-taruvi-setup.py']) checkPath(vendorRoot, `scripts/${script}`);
        const template = JSON.parse(fs.readFileSync(checkPath(vendorRoot, 'workspace-mcp.example.json')));
        validateNativeMcp(template, 'Kiro workspace template', { httpType: true, siteVariable: true });
        if (template.mcpServers?.taruvi?.type !== 'http') fail('Kiro workspace template must use native http transport');
      }
    } catch (error) { fail(`${vendor}: ${error.message}`); }
  }
}

validateOAuthPackages();
validateSelfContainedPackages();
validateCursor();
validateClaude();
validateCodex();
validateKiroHooks();
validatePayloadSkills();

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Vendor plugin files look valid.");
