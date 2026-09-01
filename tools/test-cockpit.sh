#!/usr/bin/env bash
# Open bancada against a scratch configuration.
#
# `open(1)` cannot pass an environment variable to a bundled app, so the
# binary inside the bundle is launched directly. The window says
# "not your cockpit" for as long as this is what it is reading.
#
#   tools/test-cockpit.sh [config]
set -euo pipefail

CONFIG="${1:-$HOME/.config/bancada/test.json}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$HERE/target/release/bundle/macos/bancada.app/Contents/MacOS/bancada-app"

[ -f "$CONFIG" ] || { echo "no configuration at $CONFIG" >&2; exit 1; }
[ -x "$APP" ] || { echo "no bundle at $APP — run 'bun run --cwd app build'" >&2; exit 1; }

echo "reading $CONFIG"
BANCADA_CONFIG="$CONFIG" "$APP" "$@"
