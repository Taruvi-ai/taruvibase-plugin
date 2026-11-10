#!/usr/bin/env bash
# Copy the Taruvi skills from their source of truth, Taruvi-ai/taruvi-skills,
# into skills/. Skills owned by this plugin (taruvi-setup) are left alone.
set -euo pipefail

REF="${1:-main}"
REPO="https://github.com/Taruvi-ai/taruvi-skills.git"
SYNCED_SKILLS=(taruvi-app-developer taruvi-refine-providers)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --quiet --depth 1 --branch "$REF" "$REPO" "$WORK/taruvi-skills"
COMMIT="$(git -C "$WORK/taruvi-skills" rev-parse HEAD)"

for skill in "${SYNCED_SKILLS[@]}"; do
  if [ ! -f "$WORK/taruvi-skills/skills/$skill/SKILL.md" ]; then
    echo "taruvi-skills@$COMMIT has no skills/$skill/SKILL.md" >&2
    exit 1
  fi
  rm -rf "$ROOT/skills/$skill"
  cp -R "$WORK/taruvi-skills/skills/$skill" "$ROOT/skills/$skill"
done

echo "$COMMIT" > "$ROOT/skills/.taruvi-skills-commit"
echo "Synced ${SYNCED_SKILLS[*]} from taruvi-skills@$COMMIT"
