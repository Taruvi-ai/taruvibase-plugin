import { parseDocument } from 'yaml';

export const SKILL_NAME_RE = /^(?!.*--)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;

export function parseSkillFrontmatter(content, label) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { frontmatter: {}, errors: [`${label}: missing YAML frontmatter delimiters`] };
  const doc = parseDocument(match[1], { uniqueKeys: true });
  // Report locations, not source snippets: malformed input may contain secrets.
  const errors = doc.errors.map(e => `${label}: invalid YAML (${e.code})`);
  let frontmatter;
  try { frontmatter = doc.toJS({ maxAliasCount: 50 }); }
  catch { errors.push(`${label}: invalid YAML aliases`); }
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    errors.push(`${label}: frontmatter must be a mapping`);
    frontmatter = {};
  }
  return { frontmatter, errors };
}

export function validateSkillContent({ content, label, expectedName }) {
  const { frontmatter: f, errors } = parseSkillFrontmatter(content, label);
  if (typeof f.name !== 'string' || f.name.length > 64 || !SKILL_NAME_RE.test(f.name)) errors.push(`${label}: invalid skill name`);
  if (expectedName !== undefined && f.name !== expectedName) errors.push(`${label}: name must match directory ${expectedName}`);
  if (typeof f.description !== 'string' || !f.description.trim() || f.description.length > 1024) errors.push(`${label}: description must contain 1–1024 characters`);
  for (const key of ['license', 'allowed-tools']) {
    if (f[key] !== undefined && typeof f[key] !== 'string') errors.push(`${label}: ${key} must be a string`);
  }
  if (f.compatibility !== undefined && (typeof f.compatibility !== 'string' || !f.compatibility.length || f.compatibility.length > 500)) errors.push(`${label}: compatibility must contain 1–500 characters`);
  if (f.metadata !== undefined && (!f.metadata || typeof f.metadata !== 'object' || Array.isArray(f.metadata) || Object.values(f.metadata).some(v => typeof v !== 'string'))) errors.push(`${label}: metadata must map strings to strings`);
  return errors;
}
