#!/usr/bin/env bash
# Record one fixture: a real session against public content.
#
# The format is genuine, because it came from the real binary. The content is
# public, so there is nothing to sanitise — nothing sensitive was ever there.
# See docs/specs/0001-fixture-recorder.md.
#
#   tools/record-fixture.sh <scenario> [source-repo]
set -euo pipefail

SCENARIO="${1:?usage: record-fixture.sh <scenario> [source-repo]}"
SOURCE="${2:-/mnt/dev/neo-gitmoji.nvim}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEF="$HERE/tools/scenarios/$SCENARIO.md"
OUT="$HERE/fixtures/$SCENARIO"

[ -f "$DEF" ] || { echo "no scenario at $DEF" >&2; exit 1; }
[ -d "$SOURCE" ] || { echo "no source repo at $SOURCE" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude is not on PATH" >&2; exit 1; }

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
if ! claude auth status 2>/dev/null | grep -q '"loggedIn": *true'; then
  echo "not logged in at $CONFIG_DIR — run 'claude auth login' first" >&2
  exit 1
fi

# Front matter: the first line of the scenario file is `mode: <permission-mode>`,
# the rest is the prompt.
MODE="$(head -1 "$DEF" | sed -n 's/^mode: *//p')"
[ -n "$MODE" ] || { echo "$DEF must start with 'mode: <permission-mode>'" >&2; exit 1; }
PROMPT="$(tail -n +2 "$DEF")"

# A session id we chose, so the log is found rather than guessed at. Snapshot
# diffing would race with anything else writing under the same config dir.
SESSION_ID="$(cat /proc/sys/kernel/random/uuid)"
# Both `/` and `.` become `-`. The encoding is therefore lossy — `a.b` and
# `a-b` collide — so a project directory can be *computed* from a path but
# never decoded back into one. Found by recording, not by reasoning.
ENCODED="$(printf '%s' "$SOURCE" | tr '/.' '--')"
LOG="$CONFIG_DIR/projects/$ENCODED/$SESSION_ID.jsonl"

VERSION="$(claude --version | head -1)"
COMMIT="$(git -C "$SOURCE" rev-parse HEAD 2>/dev/null || echo unknown)"
ORIGIN="$(git -C "$SOURCE" remote get-url origin 2>/dev/null || echo unknown)"

case "$ORIGIN" in
  *HenriqueArtur/bancada*|*HenriqueArtur/archwarden*|*HenriqueArtur/site*) ;;
  *github.com*) ;;
  *) echo "source has no github origin; refusing rather than recording something private" >&2; exit 1 ;;
esac

echo "recording $SCENARIO"
echo "  source   $SOURCE @ ${COMMIT:0:8}"
echo "  harness  $VERSION"
echo "  mode     $MODE"

set +e
# No MCP servers at all. Account-level connectors are listed in the log
# whether or not the session uses them, and a fixture should carry nothing
# incidental. Recording clean beats scanning afterwards and hoping.
( cd "$SOURCE" && claude -p "$PROMPT" \
    --session-id "$SESSION_ID" \
    --permission-mode "$MODE" \
    --mcp-config '{"mcpServers":{}}' \
    --strict-mcp-config \
    >/dev/null 2>&1 )
STATUS=$?
set -e

[ -f "$LOG" ] || { echo "no log at $LOG (claude exited $STATUS)" >&2; exit 1; }

mkdir -p "$OUT"
cp "$LOG" "$OUT/session.jsonl"
cat > "$OUT/meta.json" <<JSON
{
  "scenario": "$SCENARIO",
  "harness": "$VERSION",
  "permission_mode": "$MODE",
  "exit_status": $STATUS,
  "source_repo": "$ORIGIN",
  "source_commit": "$COMMIT",
  "lines": $(wc -l < "$OUT/session.jsonl")
}
JSON

echo "  → fixtures/$SCENARIO/session.jsonl  ($(wc -l < "$OUT/session.jsonl") lines)"
