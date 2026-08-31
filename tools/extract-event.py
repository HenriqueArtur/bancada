#!/usr/bin/env python3
"""Extract one tool-use event, verbatim in structure, from a real session log.

Some events cannot be recorded by `tools/record-fixture.sh`: `AskUserQuestion`
is not offered in print mode, so no scripted session can produce one. The
cheapest genuine source is an interactive session — including the one driving
this repository's own development.

This is **extraction, not recording**, and the fixture says so. Identifiers,
timestamps and the working directory are normalised, because they are the only
parts that carry anything about where the session ran. Everything inside
`message.content` is left exactly as the harness wrote it, because that is the
shape the parser is tested against.

    tools/extract-event.py <name> <tool> <log.jsonl>
"""

import json
import sys
from pathlib import Path

SESSION = "00000000-0000-4000-8000-000000000000"
CWD = "/mnt/dev/neo-gitmoji.nvim"
STAMP = "2026-01-01T00:00:00.000Z"
TOOL_ID = "toolu_fixture0000000000000"


def normalise(entry: dict, n: int) -> dict:
    out = dict(entry)
    for key in ("sessionId", "session_id"):
        if key in out:
            out[key] = SESSION
    if "cwd" in out:
        out["cwd"] = CWD
    if "timestamp" in out:
        out["timestamp"] = STAMP
    if "requestId" in out:
        out["requestId"] = "req_fixture"
    if "gitBranch" in out:
        out["gitBranch"] = "main"
    out["uuid"] = f"{SESSION[:-1]}{n}"
    out["parentUuid"] = None if n == 1 else f"{SESSION[:-1]}{n - 1}"
    return out


def retarget_tool_ids(entry: dict) -> dict:
    """Point the use and its result at one stable id, so a diff of two
    extractions shows a format change and never a fresh random id."""
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                if "id" in block and str(block["id"]).startswith("toolu_"):
                    block["id"] = TOOL_ID
                if "tool_use_id" in block:
                    block["tool_use_id"] = TOOL_ID
    return entry


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    name, tool, log = sys.argv[1], sys.argv[2], Path(sys.argv[3])

    lines = log.read_text().splitlines()
    use_i = use_id = None
    for i, line in enumerate(lines):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("name") == tool:
                    use_i, use_id = i, block.get("id")

    if use_i is None:
        print(f"no {tool} in {log}", file=sys.stderr)
        return 1

    res_i = None
    for i in range(use_i + 1, len(lines)):
        content = (json.loads(lines[i]).get("message") or {}).get("content")
        if isinstance(content, list) and any(
            isinstance(b, dict) and b.get("tool_use_id") == use_id for b in content
        ):
            res_i = i
            break
    if res_i is None:
        print(f"{tool} at line {use_i} has no result — refusing a half event", file=sys.stderr)
        return 1

    picked = [
        retarget_tool_ids(normalise(json.loads(lines[use_i]), 1)),
        retarget_tool_ids(normalise(json.loads(lines[res_i]), 2)),
    ]

    out = Path("fixtures/events") / name
    out.mkdir(parents=True, exist_ok=True)
    (out / "event.jsonl").write_text(
        "\n".join(json.dumps(e, ensure_ascii=False) for e in picked) + "\n"
    )
    (out / "meta.json").write_text(
        json.dumps(
            {
                "kind": "extracted",
                "tool": tool,
                "why": (
                    f"{tool} is not offered in print mode, so no scripted session "
                    "can record one. Taken from a real interactive session."
                ),
                "verbatim": "message.content",
                "normalised": [
                    "sessionId", "session_id", "uuid", "parentUuid",
                    "timestamp", "requestId", "cwd", "gitBranch", "tool ids",
                ],
                "lines": len(picked),
            },
            indent=2,
        )
        + "\n"
    )
    print(f"→ {out}/event.jsonl ({len(picked)} lines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
