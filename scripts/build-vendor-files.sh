#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$REPO_ROOT/src"
PAYLOAD_DIR="$REPO_ROOT/payload"
PORTABLE_SKILLS_DIR="$REPO_ROOT/skills"
SETUP_CORE="$SRC_DIR/shared/setup-core.md"

copy_dir() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  cp -a "$src/." "$dest/"
}

reset_payload() {
  rm -rf "$PAYLOAD_DIR"
  mkdir -p "$PAYLOAD_DIR/.agents/skills" "$PAYLOAD_DIR/.agents/hooks"
}

sync_portable_skills() {
  rm -rf "$PORTABLE_SKILLS_DIR"
  mkdir -p "$PORTABLE_SKILLS_DIR"

  copy_dir "$SRC_DIR/skills/taruvi-app-developer" "$PORTABLE_SKILLS_DIR/taruvi-app-developer"
  copy_dir "$SRC_DIR/skills/taruvi-refine-providers" "$PORTABLE_SKILLS_DIR/taruvi-refine-providers"
}

copy_sources() {
  copy_dir "$SRC_DIR/skills/taruvi-app-developer" "$PAYLOAD_DIR/.agents/skills/taruvi-app-developer"
  copy_dir "$SRC_DIR/skills/taruvi-refine-providers" "$PAYLOAD_DIR/.agents/skills/taruvi-refine-providers"
  copy_dir "$SRC_DIR/hooks/taruvi" "$PAYLOAD_DIR/.agents/hooks/taruvi"

  copy_dir "$SRC_DIR/vendors/claude/." "$PAYLOAD_DIR/.claude"
  copy_dir "$SRC_DIR/vendors/codex/." "$PAYLOAD_DIR/.codex"
  copy_dir "$SRC_DIR/vendors/cursor/." "$PAYLOAD_DIR/.cursor"
  copy_dir "$SRC_DIR/vendors/kiro/." "$PAYLOAD_DIR/.kiro"

  # Every vendor directory is an independently movable package root.
  for vendor in claude codex cursor kiro; do
    copy_dir "$SRC_DIR/skills/taruvi-app-developer" "$PAYLOAD_DIR/.$vendor/skills/taruvi-app-developer"
    copy_dir "$SRC_DIR/skills/taruvi-refine-providers" "$PAYLOAD_DIR/.$vendor/skills/taruvi-refine-providers"
    if [ "$vendor" != codex ]; then
      copy_dir "$SRC_DIR/vendors/codex/skills/context7-mcp" "$PAYLOAD_DIR/.$vendor/skills/context7-mcp"
    fi
  done
  copy_dir "$SRC_DIR/hooks/taruvi" "$PAYLOAD_DIR/.kiro/scripts"

  rm -rf \
    "$PAYLOAD_DIR/.kiro/settings" \
    "$PAYLOAD_DIR/.codex/log" \
    "$PAYLOAD_DIR/.codex/.personality_migration" \
    "$PAYLOAD_DIR/.codex/config.toml"
}

# Emit a YAML double-quoted scalar. Plain scalars break on ": ", leading
# indicators, and " #", so every generated frontmatter value is quoted.
yaml_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

write_setup_skill() {
  local vendor="$1"
  local skill_dir="$2"
  local name="$3"
  local description="$4"

  mkdir -p "$skill_dir"
  {
    printf '%s\n' '---'
    printf 'name: %s\n' "$(yaml_quote "$name")"
    printf 'description: %s\n' "$(yaml_quote "$description")"
    printf '%s\n\n' '---'
    printf '# %s\n\n' "$name"
    cat "$SETUP_CORE"
    printf '\n\n## %s-Specific Output\n\n' "$vendor"
    cat "$SRC_DIR/shared/setup-$(printf %s "$vendor" | tr '[:upper:]' '[:lower:]').md"

  } > "$skill_dir/SKILL.md"
}

generate_setup_skills() {
  write_setup_skill \
    "Claude" \
    "$PAYLOAD_DIR/.claude/skills/claude-setup" \
    "claude-setup" \
    "Set up Taruvi using OAuth in Claude Code. Use for setup taruvi, connecting Taruvi MCP, or configuring this app connection. Ask for the Console MCP URL/configuration, not separate slugs or API keys."

  write_setup_skill \
    "Codex" \
    "$PAYLOAD_DIR/.codex/skills/codex-setup" \
    "codex-setup" \
    "Set up Taruvi using OAuth in Codex. Use for setup taruvi, connecting Taruvi MCP, or configuring this app connection. Ask for the Console MCP URL/configuration, not separate slugs or API keys."

  write_setup_skill \
    "Cursor" \
    "$PAYLOAD_DIR/.cursor/skills/cursor-setup" \
    "cursor-setup" \
    "Set up Taruvi using OAuth in Cursor. Use for setup taruvi, connecting Taruvi MCP, or configuring this app connection. Ask for the Console MCP URL/configuration, not separate slugs or API keys."

  write_setup_skill \
    "Kiro" \
    "$PAYLOAD_DIR/.kiro/skills/kiro-setup" \
    "kiro-setup" \
    "Set up Taruvi using OAuth in Kiro. Use for setup taruvi, connecting Taruvi MCP, or configuring this app connection. Ask for the Console MCP URL/configuration, not separate slugs or API keys."
  # Codex workspace discovery uses .agents/skills even without plugin activation.
  copy_dir "$PAYLOAD_DIR/.codex/skills/codex-setup" "$PAYLOAD_DIR/.agents/skills/codex-setup"

}

assert_clean_payload() {
  local forbidden=(
    ".kiro/settings/mcp.json"
    ".codex/log/codex-tui.log"
    ".codex/.personality_migration"
    ".codex/config.toml"
  )

  for rel in "${forbidden[@]}"; do
    if [ -e "$PAYLOAD_DIR/$rel" ]; then
      echo "Forbidden runtime file in payload: $rel" >&2
      exit 1
    fi
  done

  if grep -R -lE 'ctx7sk-[A-Za-z0-9_-]+|Api-Key [A-Za-z0-9]{20,}' "$PAYLOAD_DIR" >&2; then
    echo "Payload appears to contain a real secret." >&2
    exit 1
  fi
}

reset_payload
sync_portable_skills
copy_sources
generate_setup_skills
node "$SCRIPT_DIR/sync-payload-versions.mjs"
assert_clean_payload

echo "Built vendor payload at $PAYLOAD_DIR"
