#!/usr/bin/env bash
# check-versions.sh — warn when SDK/provider versions drift from what this skill was authored against.
#
# Usage:
#   bash scripts/check-versions.sh
#
# Exit code: 0 if all pinned, 1 if any drift detected.

set -u

PINNED_PYTHON_SDK="0.1.9"
PINNED_JS_SDK="1.4.7"
PINNED_REFINE_PROVIDERS="1.3.0"

drift=0
unverified=0

check_npm() {
    local pkg="$1"
    local pinned="$2"
    if ! command -v npm >/dev/null 2>&1; then
        echo "  [skip] npm not installed — cannot check $pkg"
        unverified=1
        return
    fi
    local latest
    latest=$(npm view "$pkg" version 2>/dev/null || echo "?")
    if [ "$latest" = "?" ]; then
        echo "  [skip] could not fetch $pkg version"
        unverified=1
        return
    fi
    if [ "$latest" != "$pinned" ]; then
        echo "  [drift] $pkg: pinned=$pinned, latest=$latest"
        drift=1
    else
        echo "  [ok]    $pkg: $pinned"
    fi
}

check_pypi() {
    local pkg="$1"
    local pinned="$2"
    if ! command -v curl >/dev/null 2>&1; then
        echo "  [skip] curl not installed — cannot check $pkg"
        unverified=1
        return
    fi
    local latest
    latest=$(curl -s "https://pypi.org/pypi/$pkg/json" | python3 -c "import sys, json; print(json.load(sys.stdin)['info']['version'])" 2>/dev/null || echo "?")
    if [ "$latest" = "?" ]; then
        echo "  [skip] could not fetch $pkg version"
        unverified=1
        return
    fi
    if [ "$latest" != "$pinned" ]; then
        echo "  [drift] $pkg: pinned=$pinned, latest=$latest"
        drift=1
    else
        echo "  [ok]    $pkg: $pinned"
    fi
}

echo "Taruvi skill version check — taruvi-app-developer"
echo "---------------------------------------------------"
check_pypi "taruvi" "$PINNED_PYTHON_SDK"
check_npm "@taruvi/sdk" "$PINNED_JS_SDK"
check_npm "@taruvi/refine-providers" "$PINNED_REFINE_PROVIDERS"
echo ""

if [ "$drift" -eq 1 ]; then
    echo "Drift detected. Skill content may reference older API shapes."
    echo "Verify against package source before trusting skill specifics."
    exit 1
fi

if [ "$unverified" -eq 1 ]; then
    echo "Version freshness not verified: one or more registry checks were unavailable."
    exit 2
fi
echo "Pinned versions match registry versions. API behavior still requires validation."
exit 0
