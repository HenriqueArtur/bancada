# 0001 — Fixture recorder

**status** done — three fixtures recorded
**features** — (tooling; nothing ships from it)
**decisions** A7 (public repository), and the format-drift risk in
[../RISKS.md](../RISKS.md)

## Intent

The product reads session logs whose format is internal and undocumented.
Confidence in the parser requires testing against **real** logs, and a real log
of Henrique's work carries client code — in tool inputs, tool outputs, file
contents, diffs and error messages. Sanitising it is not safe: the content is
everywhere, and one missed field lands in a public git history that cannot be
rewritten.

Hand-written synthetic fixtures fail differently. They test the author's
*assumption* about the format rather than the format: a field shape nobody
anticipated is absent from the fixture, the test passes, and the parser breaks
in production.

The recorder resolves both by running **real sessions against public content**.
The format is genuine, because it came from the real binary. The content is
public, so there is nothing to sanitise — nothing sensitive was ever there.

It has a second job that matters as much: **format regression detection.**
Re-record after a harness upgrade and diff the new fixture against the old, and
a format change surfaces as a reviewable diff instead of as a broken parse in
production.

And a third, which is why it comes first: **without a fixture there is no
failing test to write.** It is the precondition for the test discipline, not
just for the public repository.

## Contract

```
record(scenario) → fixtures/<scenario>/
    session.jsonl      the log, verbatim
    meta.json          harness version, date, scenario name, source repo + commit
```

`meta.json` exists so a fixture that starts failing can be read as *"recorded
against harness 2.1.233"* rather than investigated as a mystery.

## Acceptance criteria

1. Given a scenario definition, when the recorder runs, then a real session
   executes against the public source repository and its log lands under
   `fixtures/<scenario>/`.
2. The recorder points the harness at a **temporary config directory**, so it
   never touches the operator's own sessions, history or credentials store.
3. Given a scenario that provokes a structured question, the recorded log
   contains that question as a tool-use entry with its options.
4. Given the same scenario recorded twice against the same harness version, the
   two logs differ only in identifiers and timestamps — anything else is a
   finding about the harness, not about the recorder.
5. `meta.json` records the harness version, and re-recording against a
   different version is visible in the diff.
6. No path under `fixtures/` contains a reference to a private repository.

## Scenarios

At least these four, because they exercise event shapes that differ:

- a structured question with options
- a tool call that requires permission
- an error
- a session long enough to compact

More will be needed. A fixture set is grown when a shape surprises the parser,
not designed up front.

## Out of scope

- Parsing. That is 0002; this only produces input for it.
- Redaction of any kind. If redaction is ever needed, the source repository was
  the wrong choice.
- Recording control-mode sessions. Observe mode first.

## How it runs

`tools/record-fixture.sh <scenario> [source-repo]`, inside the personal VM,
whose `CLAUDE_CONFIG_DIR` is a separate slot by construction — so recording
touches neither the operator's own history nor the credentials beside it.

The session id is **chosen by the recorder** rather than discovered
afterwards. Snapshot-diffing the log directory would race with anything else
writing under the same config dir, and the failure would be a fixture of the
wrong session, which is worse than no fixture.

The source repository must have a GitHub origin, and the recorder refuses
rather than recording when it does not. Default source:
`neo-gitmoji.nvim` — small enough that a failing test can be read by hand.

## What recording taught us

Three things the first runs settled, none of which reasoning would have.

**The project directory encoding turns both `/` and `.` into `-`.**
`/mnt/dev/neo-gitmoji.nvim` becomes `-mnt-dev-neo-gitmoji-nvim`. So the
encoding is **lossy**: `a.b` and `a-b` collide. A project directory can be
*computed* from a path and never decoded back into one — which means the
product must find a project's log directory by encoding a registered path,
never by reading a directory name and reversing it.

**`AskUserQuestion` is not offered in print mode.** Not "the agent chose not to
ask" — the tool is absent from the session, and the agent said so in the
recorded log:

> `AskUserQuestion` isn't available in this session — it's not in my tool list

So a question fixture cannot come from `claude -p` at all. It needs either an
interactive session recorded by hand, or the control-mode round trip (spike 5).
The scenario that was going to produce it is now `exploration`, which is a
genuine multi-tool working session and worth having on its own terms.

**Account-level MCP connectors are written into the log** whether or not the
session touches them, so the first recordings carried a list of the operator's
configured connectors. Fixed at recording time rather than by editing
afterwards: the recorder passes an empty MCP config with `--strict-mcp-config`,
so the fixture stays genuine and carries nothing incidental. Scanning a fixture
and finding it clean does not scale; recording clean does.

## Two kinds of fixture

**Recorded** — `fixtures/<scenario>/session.jsonl`, a whole session produced by
`tools/record-fixture.sh`. Genuine output of the binary, nothing touched.

**Extracted** — `fixtures/events/<name>/event.jsonl`, one tool-use event and
its result, taken from a real interactive session by
`tools/extract-event.py`. It exists because some events cannot be recorded at
all: `AskUserQuestion` is absent from print mode, so no scripted session
produces one.

The distinction is labelled rather than blurred. An extracted fixture has
`"kind": "extracted"` in its metadata and lists exactly what was normalised —
identifiers, timestamps, working directory. Everything inside
`message.content` is verbatim, because that is the shape the parser is tested
against, and normalising the rest is what keeps two extractions comparable: a
diff then shows a format change and never a fresh random id.

The cheapest genuine source of an interactive event turned out to be the
session driving this repository's own development.

## Open

- **A permission prompt cannot be recorded in print mode either.** Nothing can
  answer it. It can be extracted the same way once one occurs, or recorded
  once control mode exists — spike 5.
- **A session long enough to compact** is expensive and is not one of the
  three. It comes when compaction detection does.
