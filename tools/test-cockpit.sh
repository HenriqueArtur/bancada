#!/usr/bin/env bash
# Open bancada against a scratch configuration.
#
# Through `open --env`, not by running the binary inside the bundle: macOS
# gives an app its identity through LaunchServices, and a process started
# directly is not the app as far as notifications are concerned. The window
# says "not your cockpit" for as long as this is what it is reading.
#
#   tools/test-cockpit.sh [config]
set -euo pipefail

CONFIG="${1:-$HOME/.config/bancada/test.json}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$HERE/target/release/bundle/macos/bancada.app"

[ -f "$CONFIG" ] || { echo "no configuration at $CONFIG" >&2; exit 1; }
[ -d "$APP" ] || { echo "no bundle at $APP — run 'bun run --cwd app build'" >&2; exit 1; }

echo "reading $CONFIG"
open -n --env "BANCADA_CONFIG=$CONFIG" -a "$APP"
