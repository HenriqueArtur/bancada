#!/usr/bin/env bash
# Take a picture of the probe page, with no permissions and no window.
#
# macOS refuses this session both screen capture and accessibility, so the
# only way to see the interface is to render it somewhere that answers to a
# command line. Headless Chrome does, and it is the same Chromium the webview
# runs on.
#
#   bun run --cwd web dev --port 5199 &
#   tools/look.sh out.png "?light"
set -euo pipefail

OUT="${1:?usage: look.sh <out.png> [query] [width] [height]}"
QUERY="${2:-}"
W="${3:-1180}"
H="${4:-700}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

[ -x "$CHROME" ] || { echo "no Chrome at $CHROME" >&2; exit 1; }
curl -sfo /dev/null "http://localhost:5199/probe/" || {
  echo "nothing serving on 5199 — run 'bun run --cwd web dev --port 5199' first" >&2
  exit 1
}

"$CHROME" --headless=new --disable-gpu --force-device-scale-factor=2 \
  --virtual-time-budget=9000 --window-size="$W,$H" \
  --screenshot="$OUT" "http://localhost:5199/probe/$QUERY" >/dev/null 2>&1

echo "$OUT"
