# G4 · Automating only what is not a decision

The agreed L2. The line is not between small and large decisions. It is
between **deciding about the work** and **establishing that nobody needs to be
consulted**.

## G4.1 ◐ Continuity nudge `[content]`

The session stopped only to report, with no pending question and declared work
still open → tell it to continue. It does not opine on the code. Depends on
[G3.4](G3-detection.md).

## G4.5 ○ Cross-harness agent `[content]`

One canonical definition — name, description, instructions, tool policy, model
— that each adapter **compiles to its harness's native format**. There is no
cross-harness agent runtime; what exists is one definition and one translation
per adapter.

**Ephemeral materialisation, never on disk:** `--agents` as inline JSON,
`--mcp-config` as a string, `--append-system-prompt`. The client's repository
gains no product files and nothing forgotten ends up in a PR.

Lives at two levels with inheritance, like everything else: yours globally,
plus those declared by the project or the documentation — which **travel with
the repository**, and that is what makes the ESP32 specialist arrive together
with the study.

What does not map **degrades out loud**: each adapter declares whether it has
subagents, personas, tool policy and model choice, and the product says so
("on this harness it runs as a persona, not a subagent").

⚠ **An agent definition is content, and it has scope.** An agent whose prompt
cites one client's conventions, used on another, is a leak. Global must be
neutral.

## G4.6 ○ The product as an MCP server `[meta]`

Free reads, writes only as proposals.

`decisions.search`, `activities.list`, `resources.status` — scoped to the
session's workspace. The agent **asks mid-work** — *"did we already decide
something about this?"* — instead of only receiving context injected at the
start. Injection serves what was anticipated; querying serves what was not.

`activities.propose(...)` is the only write channel, and it **does not
persist**: it lands as pending and becomes a cheap queue item you approve, edit
or discard. Resolves the contradiction with [G8.1](G8-activities.md) without
letting AI write into unreviewed memory.

Because MCP is cross-harness, this is the product's **second harness-independent
surface**.

*Transport:* **stdio, child of the harness, per session.** No port, no network,
no token — containment by construction.

## G4.7 ○ MCP state per runtime `[meta]`

A health check returns three states that demand three different actions from
**you**:

- `✔ Connected` — usable
- `! Needs authentication` — configured and reachable, useless until you
  authenticate
- `⏸ Pending approval` — present in `.mcp.json` but not approved, so it **never
  even tries to connect**

The third one already cost real time: a session log records an investigation
that ended at `enabledMcpjsonServers: []` in **that project's** config —
approval is per project, so the same server can be connected in one and pending
in another.

**Shows, does not block.** *Collection:* the health check costs seconds, so it
runs on demand and at preflight ([G5.8](G5-operating.md)); during a session,
servers dropping and returning **appear free in the event stream**.

## G4.2 ◐ Learned permission policy — inverted `[meta]`

The original version ("you approved `npm test` 47 times, always allow?") **does
not work here**: under `bypassPermissions`, which is the real mode of use,
`allow` is inert. Learning an allowlist would have no effect.

Inverted, it works exactly where you are: it observes what you **never** run
and what you declined, and proposes a **`deny`** rule for the default profile —
because `deny` survives bypass.

```
"never saw Bash(gcloud *) approved in 340 turns
 of this workspace. Add to the dev profile's deny?"
```

Feeds [G6.11](G6-governance.md) with measured data instead of a list written
from memory.

## G4.3 ○ Escalation per class, never global

Autonomy per kind of decision, not a master switch. "Read permission" can rise
to L2 while "approve plan" stays at L1 forever. **L3 is out of the product.**

## G4.4 ○ Agent profiles + triggers `[content]`

Preconfigured profiles — `reviewer`, `debugger`, whatever you define — that
take on an activity running with **that project's account**, inside the
workspace, without leaking out.

Assignment is **manual** or **by a deterministic rule of yours**: "PR opened →
reviewer", "session stuck 2h → debugger". That is not an agent deciding, it is
automation you configured — same nature as the rules engine, and that is why it
does not cross into L3. The line holds: what creates work is you, or a rule of
yours, never an agent.

⚠ Triggers misfire sometimes; they must be easy to disable and every firing
must appear in the log.
