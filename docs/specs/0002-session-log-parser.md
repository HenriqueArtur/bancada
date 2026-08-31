# 0002 — Session log → normalised events

**status** draft
**features** G0.1 (the queue needs events to rank)
**decisions** ADR-004 (rules engine has no AI), hard rule 1
**depends on** [0001](0001-fixture-recorder.md)

## Intent

Turn one harness's session log into the normalised event model, so that
nothing above the adapter layer knows which harness produced it. This is the
first half of observe mode and the input to everything the rules engine does.

The log format is internal and undocumented, so this specification is written
from **recorded fixtures rather than from reasoning**, and the contract below
already differs from what the architecture document guessed.

## What the fixtures actually contain

Line types, across three recorded sessions:

```
assistant  19    user  13    attachment  9
queue-operation  6     last-prompt  4     ai-title  4
```

`assistant.message.content[]` holds `text`, `thinking` or `tool_use`.
`user.message.content[]` holds `tool_result`, or the content is a bare string
for a human turn.

Three corrections this forces on the model the architecture document sketched:

**There are no turn boundaries in the log.** No line says a turn began or
ended. `TurnStarted` and `TurnEnded` are *derived* — a human turn opens one,
the next closes the previous — and derivation is not the parser's job.

**`thinking` and `tool_result` were missing from the model.** Both are real,
both are frequent, and a model that cannot name them would force the parser to
drop events it can see.

**Token usage is per assistant message, not per turn.** Every assistant line
carries `input_tokens`, `output_tokens`, `cache_read_input_tokens` and
`cache_creation_input_tokens`. Summing them into a turn is, again, derivation.

## Contract

```
parse(log: &str) -> Parsed

Parsed {
    events: Vec<Event>,
    skipped: Vec<Skip>,   // counted and named, never silent
}

Skip { line: usize, reason: SkipReason }
SkipReason::UnknownLineType(String) | ::Malformed(String) | ::NotAnEvent(String)
```

**A line the parser does not understand is counted and named, never dropped in
silence.** A parser that reports nothing is indistinguishable from a log that
contained nothing, and the format changes without warning between harness
versions — so the count is how a change announces itself.

## Acceptance criteria

1. Given `fixtures/simple-read`, parsing yields at least one `ToolCall` named
   `Read` and at least one assistant `Text`.
2. Given `fixtures/tool-and-error`, parsing yields two `ToolCall`s named
   `Bash`, and the failing one yields a `ToolResult` whose `ok` is false.
3. Given `fixtures/events/ask-user-question`, parsing yields one `Asked`
   carrying three options, each with a label, a description and a preview.
4. Given a line whose `type` the parser does not know, it appears in `skipped`
   with that type named, and parsing continues.
5. Given a malformed line in the middle of a valid log, the lines around it
   still parse — a file being written while it is read must not lose
   everything after the truncated line.
6. Every event carries the session id and the timestamp of the line it came
   from.
7. Parsing a log twice yields identical output.

## Out of scope

- **Deriving turns.** A layer above, once there is a second consumer for it.
- **`FileChanged`.** No fixture exercises `Edit` or `Write`; the field
  `toolUseResult` appears and is not yet understood. Adding it from guesswork
  is the failure mode 0001 exists to prevent.
- **Watching.** This is a pure function from text to events. Tailing is the
  runtime's job.
- **Any other harness.** The trait comes when there is a second one.

## Open

- **`attachment`, `queue-operation`, `last-prompt`, `ai-title`** are present
  and carry no event we need today. They are named skips rather than silent
  ones, so if one of them turns out to matter the count is already there.
