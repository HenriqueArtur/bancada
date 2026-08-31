# 0001 — Fixture recorder

**status** implemented; blocked on a login
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

## Open

- **A permission prompt cannot be recorded in print mode.** Nothing can answer
  it, so the session either refuses or hangs. That fixture waits for the
  control-mode round trip, spike 5. The three scenarios that ship now are a
  plain read, a tool call plus a deliberate failure, and a structured question.
- **Whether a structured question survives print mode at all** is an empirical
  question the first run answers: the tool-use block may be written to the log
  before the session ends with nothing to answer it, which is exactly the
  fixture we want, or it may never be emitted.
- **A session long enough to compact** is expensive to record and is not one of
  the three. It comes when compaction detection does.
