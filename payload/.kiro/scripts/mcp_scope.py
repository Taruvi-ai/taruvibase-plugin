#!/usr/bin/env python3
"""Gate Taruvi calls using workspace scope and session-bound attestation.

This checks local evidence, not the remote connection. --record is an explicit
agent/operator attestation after a harmless live read, never automatic proof.
"""
import argparse
import json
import re
import sys
from pathlib import Path
from config_check import load_config, read_env, validate_server, fingerprint, site_origin

# Only these non-mutating tools can establish live scope before confirmation.
PROBES = {'get_datatable_schema', 'get_ai_docs'}
OAUTH_PROBES = {'get_sites', 'get_apps'}


def event_tool(value, servers):
    # Accept documented-style source selectors and common MCP qualified IDs.
    for pattern in (r'^mcp__(.+?)__(.+)$', r'^@?([^/]+)/([^/]+)$', r'^([^:]+):([^:]+)$'):
        match = re.fullmatch(pattern, value)
        if match:
            return match.group(1), match.group(2)
    # Kiro V3 emits mcp_<sanitized-server>_<tool>. Resolve against configured
    # names; never guess by splitting underscores inside a server name.
    matches = []
    for name in servers:
        prefix = 'mcp_' + re.sub(r'[^a-zA-Z0-9_]', '_', name) + '_'
        if value.startswith(prefix):
            matches.append((name, value[len(prefix):]))
    if len(matches) == 1:
        return matches[0]
    raise ValueError('Cannot uniquely determine workspace MCP server from tool ID')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--quiet', action='store_true')
    parser.add_argument('-v', '--verbose', action='store_true')
    parser.add_argument('--server', default='taruvi')
    parser.add_argument('--session-id')
    parser.add_argument('--record', action='store_true')
    parser.add_argument('--observed-site-url')
    parser.add_argument('--observed-app-slug')
    parser.add_argument('--observed-site-slug')
    args = parser.parse_args()
    root = Path.cwd()
    state = root / '.kiro/.taruvi-mcp-confirmed'
    try:
        raw = '' if sys.stdin.isatty() else sys.stdin.read()
        event = json.loads(raw) if raw.strip() else {}
        if not isinstance(event, dict):
            raise ValueError('Invalid hook event')
        servers = load_config(root / '.kiro/settings/mcp.json')
        name, tool = args.server, None
        if event:
            name, tool = event_tool(event.get('tool_name', ''), servers)
        session = event.get('session_id') or args.session_id
        if not isinstance(session, str) or not session.strip():
            raise ValueError('Session ID required; use the current hook session_id')
        env = read_env(root / '.env')
        site, app = validate_server(servers.get(name), env)
        from urllib.parse import urlparse
        from config_check import OAUTH_HOSTS
        oauth = urlparse(servers[name].get('url', '')).hostname in OAUTH_HOSTS
        inputs = event.get('tool_input', {})
        if not isinstance(inputs, dict) or inputs.get('app_slug', app) != app:
            raise ValueError('Tool app_slug does not match workspace app')
        if oauth:
            for key, expected in [('site_id', site), ('app_id', app)]:
                if key in inputs and inputs[key] != expected:
                    raise ValueError('Tool site_id/app_id does not match workspace scope')
            if 'site_ids' in inputs and inputs['site_ids'] != [site]:
                raise ValueError('Tool site_ids does not match workspace scope')
            if 'app_ids' in inputs and inputs['app_ids'] != [app]:
                raise ValueError('Tool app_ids does not match workspace scope')
        digest = fingerprint(name, {'server': servers[name], 'site': site, 'app': app, 'runtime_scope': {k: env.get(k) for k in ('TARUVI_SITE_SLUG', 'TARUVI_APP_SLUG', 'TARUVI_SITE_URL')}})
        if args.record:
            if event or not args.observed_app_slug:
                raise ValueError('Record requires explicit observed site/app from a harmless live read')
            if oauth:
                if args.observed_site_slug != site or args.observed_app_slug != app:
                    raise ValueError('Observed OAuth site/app does not match the Console MCP URL')
            elif not args.observed_site_url or site_origin(args.observed_site_url) != site or args.observed_app_slug != app:
                raise ValueError('Observed live scope does not match workspace configuration')
            if state.is_symlink():
                raise ValueError('Refusing confirmation-state symlink')
            state.write_text(json.dumps({'fingerprint': digest, 'session_id': session, 'server': name}) + '\n')
            state.chmod(0o600)
        else:
            confirmed = {}
            if state.exists() and not state.is_symlink():
                try:
                    confirmed = json.loads(state.read_text())
                except ValueError:
                    pass  # Old hash-only state is unconfirmed, never trusted.
            valid = isinstance(confirmed, dict) and confirmed.get('fingerprint') == digest and confirmed.get('session_id') == session and confirmed.get('server') == name
            if not valid and tool not in (OAUTH_PROBES if oauth else PROBES):
                raise ValueError('Live scope is unconfirmed or changed. Perform a read-only scope probe, then record the observed site/app for this session before mutations')
        if not args.quiet:
            print(f'Workspace scope: {name} -> {site} / {app}')
        return 0
    except (ValueError, TypeError, OSError) as error:
        # Exit 2 is the blocking hook failure. Always explain failures on stderr.
        print(f'Taruvi scope check: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
