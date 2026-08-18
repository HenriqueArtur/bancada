# Spikes

Ordered. The first two are half of the first slice.

## 1. Fixture recorder

A script that creates a session against a **public repository** with scripted
prompts, and captures the resulting session logs.

```
1. point the harness config at a temporary directory
2. run real sessions with scripted prompts
     — one that makes the agent ask a structured question
     — one with a tool call and a permission
     — one that errors
     — one long enough to compact
3. copy the logs into fixtures/
```

Real format, because it came from the real binary. Invented context, because
the repository is public. Nothing to sanitise, because nothing sensitive was
ever there.

**Two reasons it comes first.** Without a fixture there is no failing test to
write — it is the precondition for the whole test discipline. And once a real
private log lands in a public git history, it cannot be removed.

**It is also a format regression detector.** Re-run after a harness update and
diff the new fixture against the old.

## 2. Session log → normalised events

Take a recorded fixture and turn it into `Event[]`. Pure function, no I/O, no
clock, no concurrency — the textbook case for writing the test first.

Snapshot testing rather than hand-written expectations: run it, review the
generated output, commit it. When the format changes, the snapshot diff shows
exactly what.

## 3. Computed reach

Cross runtime mounts with project paths and check that the warning comes out
right on a real setup. Cheap, and it validates the only isolation feature the
product creates.

## 4. Does an `ask` rule survive the permissive base mode?

The documentation confirms that deny blocks in every mode and that allow is
inert under bypass, but is silent about ask. Ten minutes. If ask survives, the
permission profile can confirm instead of block, which is strictly better.

## 5. Round trip over the streaming protocol

Prove control mode: send a prompt, read the answer, answer a question. This is
the gate for everything beyond read-only.

## 6. Permission interception

Resolve the unconfirmed item in [RISKS.md](RISKS.md).

## 7. Live session discovery across runtimes

Prove multi-runtime discovery, with a probe running in a login shell.

---

## The injected clock

Not a spike — a rule that decides whether any of this is testable.

**Never call `now()` inside the rules engine.** The ranking is
`kind × (age × weight) × blocking` — a **function of time**. If time is
ambient, "40 minutes have passed" cannot be tested without sleeping, the tests
go flaky, and the most important piece of the product becomes the least tested.

```rust
// no
fn rank(items: &[Item]) -> Vec<Ranked> { let now = SystemTime::now(); … }

// yes
fn rank(items: &[Item], now: Instant) -> Vec<Ranked> { … }
```

Same rule for every other source of non-determinism: randomness, directory read
order, environment.
