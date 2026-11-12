#!/usr/bin/env python3
import argparse
import stat
import sys
from pathlib import Path
from config_check import load_config, read_env, validate_server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--server', default='taruvi')
    args = parser.parse_args()
    root = Path.cwd()
    env_path, mcp_path = root / '.env', root / '.kiro/settings/mcp.json'
    try:
        site, app = validate_server(load_config(mcp_path).get(args.server), read_env(env_path))
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 1
    for p in (env_path, mcp_path):
        if p.exists() and stat.S_IMODE(p.stat().st_mode) & 0o077:
            print(f'Warning: prefer chmod 600 for {p.name}.')
    print(f'Taruvi configuration matches {site} / {app}. Live connection is not verified by this check.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
