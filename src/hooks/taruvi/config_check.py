"""Shared local configuration checks. Never print credential values."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs


def read_env(path):
    result = {}
    if path.exists():
        for raw in path.read_text().splitlines():
            line = raw.strip()
            if line.startswith('export '):
                line = line[7:]
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                result[key.strip()] = value.strip().strip('\"').strip("'")
    return result


def load_config(path):
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except (ValueError, OSError):
        raise ValueError('Cannot read MCP configuration JSON') from None
    if not isinstance(data, dict) or not isinstance(data.get('mcpServers'), dict):
        raise ValueError('MCP configuration must contain an mcpServers object')
    return data['mcpServers']


def usable(value):
    return isinstance(value, str) and bool(value.strip()) and not any(x in value for x in ('<', '>', '${', '\n', '\r'))


def site_origin(value):
    if not usable(value):
        raise ValueError('Missing or placeholder site URL')
    try:
        url = urlparse(value)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
            raise ValueError()
        port = url.port
        return 'https://' + url.hostname.lower() + (f':{port}' if port and port != 443 else '')
    except ValueError:
        raise ValueError('Site URL must be an HTTPS origin without credentials, query, or path') from None


OAUTH_HOSTS = {'mcp.taruvibase.com', 'test-mcp.taruvibase.com'}


def oauth_scope(server, env):
    """Return verified local scope, not authentication or remote identity proof."""
    endpoint = server.get('url')
    if not usable(endpoint):
        raise ValueError('Missing or placeholder MCP URL')
    parsed = urlparse(endpoint)
    if parsed.scheme != 'https' or parsed.hostname not in OAUTH_HOSTS or parsed.port not in (None, 443) or parsed.username or parsed.password or parsed.fragment or parsed.path != '/mcp':
        raise ValueError('OAuth MCP URL must use an approved Worker HTTPS /mcp endpoint')
    if server.get('headers') or server.get('env') or server.get('oauth'):
        raise ValueError('OAuth uses client-managed discovery and credentials; remove custom headers/auth overrides')
    try:
        query = parse_qs(parsed.query, keep_blank_values=True, strict_parsing=True)
    except ValueError:
        raise ValueError('Malformed OAuth MCP query') from None
    if set(query) - {'siteId', 'appId', 'readonly', 'category'}:
        raise ValueError('Unknown OAuth MCP query parameter')
    for key in ('siteId', 'appId'):
        values = query.get(key, [])
        if len(values) != 1 or not usable(values[0]) or values[0] != values[0].strip() or values[0] in ('.', '..') or '/' in values[0]:
            raise ValueError('OAuth workspace connection requires one explicit siteId and appId')
    if 'readonly' in query and query['readonly'] not in (['true'], ['false']):
        raise ValueError('readonly must be one true or false value')
    categories = {'data', 'schema', 'functions', 'storage', 'users', 'policies', 'secrets', 'analytics', 'events', 'sites', 'apps'}
    if any(v not in categories for raw in query.get('category', []) for v in raw.split(',')):
        raise ValueError('Unknown OAuth category')
    site, app = query['siteId'][0], query['appId'][0]
    for key, expected in [('TARUVI_SITE_SLUG', site), ('TARUVI_APP_SLUG', app)]:
        if env.get(key) and env[key] != expected:
            raise ValueError('OAuth scope conflicts with existing runtime site/app metadata')
    return site, app


def validate_server(server, env):
    if not isinstance(server, dict):
        raise ValueError('Missing workspace Taruvi server')
    if server.get('disabled', False) is not False:
        raise ValueError('Workspace Taruvi server is disabled')
    if server.get('type') != 'http':
        raise ValueError('Workspace Taruvi transport must be http')
    if not usable(server.get('url')):
        raise ValueError('Missing or placeholder MCP URL')
    if urlparse(server['url']).hostname in OAUTH_HOSTS:
        return oauth_scope(server, env)
    headers = server.get('headers')
    if not isinstance(headers, dict):
        raise ValueError('Missing MCP headers')
    if any(not isinstance(k, str) for k in headers) or len({k.lower() for k in headers}) != len(headers):
        raise ValueError('Duplicate MCP header names')
    headers = {k.lower(): v for k, v in headers.items()}
    app, auth = headers.get('x-app-slug'), headers.get('authorization')
    if not usable(app) or not usable(auth) or not auth.startswith('Api-Key ') or not usable(auth[8:]):
        raise ValueError('Missing or placeholder app/authentication header')
    expected = site_origin(env.get('TARUVI_SITE_URL'))
    if not usable(env.get('TARUVI_APP_SLUG')) or not usable(env.get('TARUVI_API_KEY')):
        raise ValueError('Missing or placeholder .env app/API key')
    endpoint = server.get('url')
    if not usable(endpoint):
        raise ValueError('Missing or placeholder MCP URL')
    parsed = urlparse(endpoint)
    origin = site_origin(endpoint.removesuffix('/mcp/')) if parsed.path == '/mcp/' else None
    if origin != expected:
        raise ValueError('MCP endpoint must match .env site origin and end in /mcp/')
    if app != env['TARUVI_APP_SLUG']:
        raise ValueError('App slug mismatch between .env and MCP')
    if auth[8:] != env['TARUVI_API_KEY']:
        raise ValueError('API key mismatch between .env and MCP')
    return expected, app


def fingerprint(name, server):
    # Detect credential changes too, without persisting raw credentials.
    raw = json.dumps({'name': name, 'server': server}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()
