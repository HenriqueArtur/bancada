# References

Every source that shaped a decision, and what was taken from it.

**How to read an entry:** what the source is → the specific idea taken → where
it lands in the design (`G…` codes refer to [features/](features/README.md)).

A source listed here is not an endorsement. Several are here because the
design deliberately went the other way, and the reason is worth keeping.

---

## 1. Prior art — agent cockpits and orchestrators

**[Conductor](https://www.conductor.build/)** — closed-source Mac app running
Claude Code, Codex and Cursor in parallel worktrees, with a review-and-merge
flow. Currently v0.81.
*Taken:* the isolated-worktree-per-task model, and the review-before-merge
screen. *Rejected:* it runs everything as one user with one account, so
multi-account isolation is impossible. Nothing supervises your attention.

**[bridge-commander](https://github.com/tonylampada/bridge-commander)** — a
Claude Code / Codex skill that runs a local kanban server (port 4780) over
tmux, provisions worktrees, and has a PR watcher. Doctrine: agents supervising
agents ("lieutenants", respawned by a chief agent named Bridget).
*Taken:* card→worktree, the PR watcher, workspace lifecycle hooks.
*Rejected:* single-machine, no account concept, no application-level auth
(security relies on loopback binding). The doctrine is the opposite of ours —
it removes the human from decisions we want the human to make.

**[Agent Kanban](https://agent-kanban.dev/)** — open-source board for Claude
Code, Codex, Gemini CLI, Copilot and Hermes. A leader agent plans and assigns;
workers claim tasks and ship PRs autonomously.
*Rejected for the same reason as above:* it is supervision-type-1
(orchestration). Useful as the clearest example of the doctrine we are not
building.

**[Claude Squad](https://vibecodinghub.org/blog/claude-squad-review)** — Go TUI
over tmux and git worktrees; Claude Code, Codex, Aider, Gemini. Per-edit
approval.
*Taken:* per-edit approval is a real human-in-the-loop posture, and the TUI
proves how far terminal-native gets you.

**Sculptor** — the one outlier: uses **containers** rather than worktrees, for
stronger isolation.
*Note:* our VMs are stronger isolation than either, which is why worktrees are
optional here (G5.6) rather than foundational.

**Vibe Kanban** — Bloop shut down in April 2026; the project continued as
community-maintained open source.
*Note:* read the code, do not depend on it.

**Terragon** — remote background agent orchestrator for coding CLIs in the
cloud. **Shut down.**

**[Nine open-source orchestrators
compared](https://www.augmentcode.com/tools/open-source-agent-orchestrators)**
— all nine solve parallelism the same way, with git worktrees; they vary only
in coordination depth.
*Taken:* the field has converged on worktrees **because those tools have no
other isolation** — they run as you, on your machine, in one repo. That reason
largely does not apply here, which is the argument for G5.6 being optional.

**VS Code "Agent Sessions" view** — since January 2026, VS Code runs Claude
Code, Codex and Copilot side by side in one panel.
*Taken, as a scoping constraint:* "one place with all my chats" already has a
free and good answer. **If the product is only a chat aggregator, it is born
redundant.** What is absent there is multi-account/multi-workspace isolation
and attention supervision — which is where the value has to be.

---

## 2. Supervision patterns in agent frameworks

**Erlang/OTP supervision trees** — the origin of the supervisor–worker pattern:
a supervisor process whose only job is to start, monitor and restart workers.
*Taken:* the vocabulary. *Note:* every agent framework below inherits this
shape, and it is supervision-type-1.

**LangGraph — the `supervisor` node**, plus CrewAI's hierarchical process
(manager agent), AutoGen's `GroupChatManager`, and handoffs in the OpenAI
Agents SDK. All are the same pattern with different names.

**[LangGraph `interrupt()` and human-in-the-loop
patterns](https://www.langchain.com/blog/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt)**
— a checkpoint inside a node pauses execution, surfaces state to a human, and
resumes with their input against persisted state.
*Taken:* the three interaction shapes, adopted verbatim as vocabulary —
**approve as-is**, **reject and re-route**, **edit the proposed action before
executing**. The third is the most underused: usually the answer is neither yes
nor no, it is "yes, but change this path". → G1.4

---

## 3. Attention and triage, from outside software

This is where the design differentiates, because none of the prior art in §1
looks here.

**Dark cockpit (Airbus flight deck philosophy).** In normal operation no
annunciator is illuminated. A lit indicator always means a condition requiring
crew action — lights are never used to confirm that something is fine.
*Taken:* empty queue = empty screen. And the hard consequence: **if an item can
appear when there is nothing to do, the whole queue loses meaning.** → G0.5

**ECAM alert levels (Airbus).** Alerts are classified by urgency with distinct
sensory coding — warnings requiring immediate action, cautions requiring
awareness then action, and advisories. Severity is a property of the alert, not
of arrival order.
*Taken:* ranking by cost-of-being-wrong × cost-of-delay, rather than FIFO.
→ G0.3

**Alarm fatigue.** Documented extensively in clinical care — ICU and nursing
literature, and a Joint Commission patient-safety focus on clinical alarm
management — and independently in incident management (PagerDuty and
comparable practice). The finding is consistent across both domains: a noisy
alert queue causes humans to stop responding, at which point it is worse than
having no queue. The known defenses are deduplication, grouping, suppression,
and honest severity.
*Taken:* the "needs you" queue **is** an alert queue and fails the same way.
Grouping identical permission requests is not a convenience feature, it is the
thing that keeps the queue alive. → G0.4, and the reason G5.5 notifies only for
"you are the bottleneck", never per item.

**Kanban and WIP limits (Toyota Production System, and the Kanban method as
applied to knowledge work).** The original mechanism is not a board of cards —
it is a hard limit on work in progress. A board without a WIP limit is a to-do
list with columns.
*Taken:* the limit, and the uncomfortable possibility the product should be
honest enough to raise — that the right answer to "I have 4 terminals and
cannot keep up" may be **run 2**. → G0.6

**Emergency department triage (e.g. the Manchester Triage System).** Categorize
by urgency, not by arrival order.
*Taken:* obvious once stated, and the exact opposite of what four terminals do.

**Code review queues — Graphite, Reviewable, Gerrit.** Two mature ideas: order
the queue by who is blocked waiting, and — the valuable one — **"what changed
since I last looked"**.
*Taken:* incremental review by reviewer, not by commit. This is literally the
context-restoration problem, already solved elsewhere a decade ago. → G1.1,
G2.2

---

## 4. Code review

**[Greptile — AI code review tool
comparison](https://www.greptile.com/content-library/best-ai-code-review-tools)**
and **[Mastra — AI code review
tools](https://mastra.ai/articles/ai-code-review-tools)**.
*Taken, and it became a signature feature:* the same reviewer produces signal
on a 150-line diff and noise on a 1,000-line one. The tool did not change; the
workflow gave it a solvable problem.
The consequence the whole field misses: **review quality is decided during the
session, not at review time** — and every tool reviews at the end. Nobody looks
at minute 10. → G2.3

**CodeRabbit** — continuous incremental review per commit within a PR.
*Taken:* incremental is the default, not a mode. → G2.2

**Graphite — stacked diffs.** Keeps diffs small by construction; the cost is
that the team must adopt the workflow discipline.
*Taken:* the diagnosis (diff size is upstream of review quality).
*Not taken:* the enforcement, because a product that dictates workflow gets
worked around on the first urgent day. G2.3 warns, never blocks.

---

## 5. Agent observability

**Langfuse, LangSmith, AgentOps, Arize Phoenix, Braintrust.** Tools that trace
agent runs as step graphs — planning, tool calls, handoffs, retries, model
calls, final response. Built for developers debugging agents in production, not
for an operator supervising their own work: **different user, same mechanics.**
*Taken:* the step-graph view as an answer to "what happened while I was away".
→ G2.4

**[Morph — Agent Observability: what the trace can't
see](https://www.morphllm.com/agent-observability)** and **[Latitude — agent
observability tools
2026](https://latitude.so/blog/best-ai-agent-observability-tools-2026-comparison)**.
*Taken, and it forced a design change:* step caps and exact-repeat flags catch
the obvious cases and **miss varied-argument loops and gradual drift**,
requiring semantic-level monitoring.
This is the known blind spot of pure rules. It is why detection has three
layers instead of two: rules catch "same file 5×"; only semantics catches "four
different plausible approaches to the same problem", which is the expensive
kind of stuck. → G3.1, G3.2

---

## 6. Running agents in parallel

**[getunblocked — scaling parallel AI
agents](https://getunblocked.com/blog/scale-parallel-ai-agents/)** and
**[Augment — multi-agent coding
workspace](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace)**.

*Taken — the WIP default:* Google Research reports diminishing returns beyond
five parallel agents on most task types, with coordination overhead growing
faster than throughput. **2–4 is the working range.** This turns the WIP limit
from a guess into a defensible default. → G0.6

*Taken — the top failure mode:* file collisions. Multiple agents touching the
same configuration file, routing table or component registry produce conflicts
that are painful to resolve. Structurally invisible to each agent. → G3.7

*Taken — the expensive failure mode:* context blindness. "Agent A knows about
the database schema change, Agent B knows about the API contract, neither knows
what the other is doing" — individually correct code that breaks when combined,
and it passes compile and lint. → G3.8

*Taken — the bottleneck:* verification, not generation. Agents produce code
faster than humans review it, so automation must filter most regressions before
a human sees a diff. This is the argument for the only feature that **removes**
items from the queue. → G2.5

*Context, not taken as a feature:* a three-agent pipeline consumes roughly 29k
tokens against 10k for single-agent — coordination is roughly 3× the token
cost. Worth knowing before adding agents to solve a problem.

---

## 7. Context and continuity

**[Walking Labs — keeping context alive across
sessions](https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-05-why-long-running-tasks-lose-continuity/)**
and **[session handoff
practice](https://www.jdhodges.com/blog/ai-session-handoffs-keep-context-across-conversations/)**.

*Taken — a concrete threshold:* handoff preparation should begin at about
**60% of the context window**. Today compaction simply happens, the agent
"forgets", and there is no signal. Token counts are in the log, so detecting
this is free. → G3.9, G7.5

*Taken — the handoff shape:* timestamped entries, change summaries, file paths,
commit hashes, and a context block with purpose, current state and constraints.
And the observation that matters most: **the session log becomes genuine
project documentation you can reference weeks later to remember why a decision
was made.** → G7.2, G7.5

*Taken — the format:* `AGENTS.md` as context shared across tools, written once
and picked up by every coding tool without per-tool configuration. Writing the
decision log in that format makes it harness-independent for free. → G7.4

*Taken — the discipline:* keep the always-injected memory short and link out;
raw transcripts belong in searchable storage, not in the active prompt.

---

## 8. Cost

**[Morph — AI coding costs](https://www.morphllm.com/ai-coding-costs)** and
**[cost per task](https://www.kunalganglani.com/blog/ai-agent-cost-per-task-2026)**.

*Taken, and it split a feature in two:* **most of the bill comes from context
overhead — system prompts and repo maps — not from the code the agent writes.**
The log separates `cache_creation`, `cache_read`, `input`, `output` and
`thinking`, so the split is exactly computable. It matters because overhead is
optimizable and written code is not — without the split you cannot tell which
one is costing you. → G7.1

*Context:* agent tasks run roughly $0.03–$2.60 each depending on model, tool
and codebase context.

**[Keito — time tracking for
consultants](https://keito.ai/blog/time-tracking-for-consultants/)**.
*Taken:* consultants record LLM token cost as an expense alongside time
entries, tagged by source. And the open question the industry has not settled —
how to bill when an agent does hours of work in minutes and the consultant's
time goes into review. That is the argument for measuring **your** time
separately from agent runtime. → G7.6

---

## 9. Primary sources — verified on this machine

Not literature. Measured directly, and load-bearing for the design.

**Claude Code CLI surface** (verified 2026-08-14). `--print
--input-format stream-json --output-format stream-json` gives a bidirectional
JSON stream; `--include-partial-messages` for token-level streaming;
`--session-id`, `--resume`, `--fork-session`, `--bg`; and `claude agents
--json` lists live sessions, interactive and background.
**Not found in this version:** `--permission-prompt-tool`. The likely path is
`canUseTool` in `@anthropic-ai/claude-agent-sdk` (v0.3.232). **Unconfirmed —
needs a spike.**

**Session log format.** `~/.devbox/state/<vm>/claude/projects/<encoded-path>/<uuid>.jsonl`.
`AskUserQuestion` appears as an ordinary `tool_use` block carrying
`questions[].options[].{label, description, preview}` — fully structured, so
rendering it as native UI is a drawing exercise, not a parsing one.
Per-message metadata includes `input_tokens`, `cache_creation`, `cache_read`,
`output_tokens`, `thinking_tokens`, plus `gitBranch`, `cwd`, `durationMs`,
`permissionMode` and `effort`. Dollar cost is **not** recorded — a price table
per model is required.
⚠ This format is internal and undocumented. It can change between Claude Code
versions. Contained in the adapter, with fixtures from real sessions.

**Permission modes** ([official
docs](https://code.claude.com/docs/en/permission-modes), read 2026-08-17).

| Mode | Runs without asking | Intended for |
|---|---|---|
| `default` (manual) | reads only | reviewing every action, sensitive work |
| `acceptEdits` | reads, file edits, common fs commands | iterating on code you review |
| `plan` | reads, plus classifier-approved commands | exploring before changing |
| `auto` | everything, with background safety checks | long tasks, prompt fatigue |
| `dontAsk` | only pre-approved tools | locked-down CI and scripts |
| `bypassPermissions` | everything | *"isolated containers and VMs only"* |

*Taken, and it settled a design question:* **"Deny rules block in every mode,
including `bypassPermissions`"**, while **"allow rules have no effect in
`bypassPermissions`"**. So a deny list survives the mode the user actually runs
— you can keep bypass and still gate what is irreversible, with no workflow
change. Because deny blocks in *every* mode, the switch has to be a named
**profile**, not a mode. → G6.11
*Not confirmed:* whether `ask` rules prompt under bypass. Needs a spike.

*Taken — mode switching already exists:* `Shift+Tab` cycles modes and the
status bar shows the active one. `--allow-dangerously-skip-permissions` puts
bypass **in the cycle without activating it** — start safe, escalate
deliberately. → G6.12

**The `auto` mode classifier** (read from `claude auto-mode defaults`,
2026-08-17). On Pro/Max/Team, `auto` is the factory starting mode: a second
model reviews actions instead of the human. Default rule set: **17 `allow`, 66
`soft_deny`, 1 `hard_deny`**.
The single `hard_deny` is **data exfiltration across a trust boundary** —
private-repo content reaching an external destination, a mid-session
`git remote set-url` followed by a push, shipping an entire tree to a
destination that is not the session-start remote, encoded payloads in outbound
requests. Provenance decides sensitivity, not how harmless the content looks.
*Taken:* this is the same concern the whole workspace design is about, enforced
by the harness itself — **and `bypassPermissions` disables it.** The VM
boundary and the classifier protect against different things: the VM stops
reaching *another client's* files; the classifier stops *this client's* code
going out. A VM has network, so it does not cover the second. → G6.14

**Harness discovery surface** (verified 2026-08-14). `claude auth status`
reports authentication state. `claude doctor` checks installation health.
`claude agents --json` lists live sessions.
The account identity lives in `$CLAUDE_CONFIG_DIR/.claude.json` under
`oauthAccount`: `accountUuid`, `emailAddress`, `displayName`,
`organizationUuid`, `organizationName`, `organizationRole`, `billingType`,
`seatTier`.
*Taken, and it upgraded a guarantee:* `organizationUuid` is machine-readable
proof of **which client's account** a runtime uses. The workspace↔account link
stops being a promise the user makes and becomes a fact the product checks —
including drift detection, and seeing when two runtimes share one account.
→ G6.10
The config dir is **self-contained**: `.claude.json`, `.credentials.json` and
`projects/` all live inside it. Find the config dir, find everything.
*Gotcha:* the binary path varies per runtime (`~/.local/bin/claude` on the Mac,
`/home/henrique.guest/.local/bin/claude` in the VM) and version managers like
`mise` do not exist in a non-interactive shell. **The probe must run in a login
shell.** → G6.9

**Lima / devbox topology.** VMs are local (`vmType: vz`, virtiofs mounts), not
remote. `~/Documents/dev/<subdir>` → `/mnt/dev`, and
`~/.devbox/state/<vm>` → `/mnt/state` as `CLAUDE_CONFIG_DIR`.
*Consequence:* every session log for every VM is readable from the Mac
filesystem, with no network, no per-VM daemon and no certificates. This removed
most of what would have been infrastructure work.
*Counter-consequence:* **the VM contains what is inside it but does not protect
what is outside.** An agent inside VM `sunne` cannot reach
`~/Documents/dev/personal`; an agent running locally on the Mac reads
`~/Documents/dev/work` freely. One direction is guaranteed, the other is not —
which is why an abstract `hard`/`soft` badge would be a lie and computed reach
replaced it. → G6.4

**Resource state** (measured 2026-08-14). Mac: 27 GiB free, 88% full.
`~/.lima/sunne` 19 G and `~/.lima/devbox` 6.3 G, both thin-provisioned at 30 G.
Guest `sunne` believes it has 9.0 G free; both guests together believe they can
write ~33 G against 27 GiB actually available. Guest RAM 3.8 GiB with **swap
0B** — no degradation, the OOM killer fires immediately.
*Taken:* the guest's view is a lie, and only a host-side observer can see it.
No tool in the field can, because they all run on the wrong side of the
boundary. → G3.5, G3.6

---

## 10. Our own prior art — bancada

[bancada](https://github.com/HenriqueArtur/bancada) — a local-first study
workbench. ~2,245 lines of TypeScript, 420 tests, Bun with no build step.
Plugins: [inventory](https://github.com/HenriqueArtur/bancada-inventory) and
[electronics](https://github.com/HenriqueArtur/bancada-electronics).

Listed as a reference because the design decisions transfer even if no line of
code does.

**The plugin contract, ten stages** — `configure`, `onLesson`, `cards`,
`transformBody`, `styles`, `scripts`, `assets`, `routes`, `menuItems`,
`validate`. Seven map almost verbatim onto this product's surfaces, and `cards`
— "a titled block beside the lesson" — is exactly the shape a queue item needs.

**"The order is the contract."** A plugin declared after another sees what the
previous one produced, which is how one plugin uses another's work without
importing it. The electronics plugin reads the parts inventory resolved;
neither knows the other exists.

**Collecting vs piping are distinct natures**, and `collect()` is always async
even for stages that happen to be synchronous today — because a caller forced
to know which stages read files gets it wrong the first time one starts to.
That is a scar, not a preference.

**The loader refuses rather than guesses** which export is the plugin, and the
error lists what it did find.

**Loopback write policy.** "Binding wide is how the browser reaches it across a
VM boundary; refusing the write is why that is safe." This solved the product's
network posture inside a study tool.

**i18n policy.** Labels default to English; a repository overrides only what it
needs, because a half-translated page is worse than an English one. Unsupplied
`{placeholder}` markers stay visible on screen rather than becoming
`undefined`, so you can see which label is wrong. This is exactly the
"ships in English, multi-language later" policy, already implemented.

**Notes live outside the content folders**, so the content can be shared as a
template without your progress riding along. → G9.5, and the same distinction
as issue (theirs) vs activity (yours).

**The `extra` field** (inventory). Subject-specific attributes ride along
untouched, read only by the plugin that understands them — so a 3D-printing
repository does not carry a field about voltage.

**Bun lock-in is smaller than the README suggests.** Only `Bun.file`,
`Bun.write` and `Bun.serve`; everything else (`gray-matter`, `marked`,
`marked-highlight`, `highlight.js`) is ordinary npm. Leaving Bun is a small
port, not a rewrite.

⚠ **Bun's native Windows binary is still experimental**, with WSL2 the common
workaround — which is not viable for an ordinary installation. Relevant because
the documentation viewer must run installed on Windows (G9.6). See [DECISIONS.md](DECISIONS.md).
