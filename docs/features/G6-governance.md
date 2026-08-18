# G6 · Governance

## G6.1 ○ Project registration

Four independent axes: runtime, account, workspace, repo. The question you
answer when registering is *"whose is this?"* — trivial, and you never get it
wrong. If it were *"what confidentiality level?"* you could get it wrong on
autopilot, and the error stays silent until it leaks.

## G6.9 ○ Runtime discovery — proposes, you register `[meta]`

Each provider enumerates candidates its own way — VM listings, container
listings, WSL distributions, ssh config hosts, and the machine itself. The
product shows what it found, with harness and version detected, and **you
promote** what matters. Automatic registration would be noise on day one:
forty containers hide the three that matter. Same pattern as calibration:
proposes, you accept.

The probe runs in a **login shell**: binary paths vary per runtime, and version
managers do not exist in a non-interactive shell.

## G6.10 ★ Account identity read, not typed `[meta]`

The product extracts `accountUuid`, `emailAddress`, `organizationUuid`,
`organizationName` and `organizationRole` from the harness config. You answer
one question: **which workspace this account belongs to.** The machine knows
which account it is; only you know whose work it is.

Three things come free:

- the workspace↔account link stops being a promise and becomes a **checkable
  fact**;
- **drift detection** — "this runtime is declared as `sunne`, but the account
  logged in there belongs to organization X";
- two runtimes with the same `accountUuid` **share an account**, and the
  product sees it instead of depending on you remembering.

## G6.2 ○ Export level on the workspace, project inherits `[meta]`

`metadata` · `summary` · `full`. Few policies, many projects. A new project is
born at `metadata`.

## G6.3 ◐ Permissive state visible `[meta]`

A workspace above `metadata` appears in the UI chrome, never buried in a
settings screen.

## G6.4 ★ Computed reach `[meta]`

The product knows where each project lives and what each runtime mounts, so it
computes who reaches what and warns only where real reach exists between
different workspaces.

A verifiable, actionable fact — you move the folder and the warning goes — in
place of an abstract badge, which would lie: **a VM contains what is inside it
but does not protect what is outside**, and an adjective carries no direction.

**Reports only, never blocks.** The product is not a security tool; whoever
wants to read the file opens a terminal. The warning is dismissible per project
once acknowledged.

## G6.5 ○ Account for a workspace with no VM

A workspace that exists only on the machine gets its own harness config
directory. Same mechanics as an isolated runtime, without the runtime around
it.

## G6.6 ○ Weight and thresholds per project `[meta]`

Every number in the rules engine has a per-project default: session duration,
time without an event, tokens without a file change, same file N times, diff
size, and the ranking weight. Inheritance follows the export level pattern —
the workspace sets the default, the project overrides. Named presets
(`normal`, `long refactor`, `exploratory`) avoid configuring anything to start.

## G6.7 ◐ Calibration from history `[meta]`

A button that reads that project's session logs and proposes **measured**
thresholds instead of guessed ones — "this project's sessions have a 3.5h
median; the diff sits at 890 lines at p75". Possible only because the history
already exists and is all metadata: calibrating reads no content and leaves no
workspace. No tool in the field has that data at hand.

⚠ **A learned baseline normalises dysfunction.** A project that lives with
stuck sessions teaches the system that stuck is normal, and detection dies
silently. So it is a **deliberate act with a visible result** — you press, you
see the proposed numbers, you accept or not — never continuous silent
adaptation.

## G6.8 ○ Resource thresholds per runtime `[meta]`

A **different** axis from G6.6: resources belong to the machine, not the
project. Minimum free space on the host, overcommit ceiling, minimum available
memory, load — all per runtime. Two projects on the same runtime share the same
resource limit and can have completely different weights and stagnation
thresholds.

## G6.11 ○ Permission profile: base + tool policy `[meta]`

A profile is a base mode plus `allow` / `ask` / `deny` lists by tool pattern.
Inherits workspace → project → session.

The finding that makes it worth it, confirmed in the official docs: **`deny`
blocks in every mode, including `bypassPermissions`** — and `allow` is inert
under bypass. So the permissive mode can stay exactly as it is **and still
gate what is irreversible**, with no mode switching.

Because `deny` blocks in *every* mode, a raw deny would also block deliberate
infrastructure work. The way out is a **named profile**, not a mode:

```
profile dev  (default)
  base  bypassPermissions
  deny  Bash(gcloud *) Bash(terraform *) Bash(kubectl *)
        Bash(git push --force*)

profile gcp-ops
  base  default (manual)
  deny  —
```

You already switch context by hand; the profile only makes it explicit and
fast. Zero friction day to day, a real gate on what does not come back.

## G6.12 ○ Mode always visible, one-click switch `[meta]`

The active mode appears permanently in the UI chrome — **an unsafe mode is
never silent**. Same principle as a permissive workspace: a permissive state is
always explicit.

Worth knowing: the harness has a flag that **puts bypass in the switching cycle
without activating it** — start safe, escalate when you want, instead of being
born loose.

## G6.13 ○ Mode audit per workspace `[meta]`

The mode is recorded on every log entry. Aggregating per workspace is free, and
it answers with what guard each client's work was done.

## G6.14 ○ Classifier-gap warning `[meta]`

On some plans the factory mode is a classifier-reviewed one, whose single
hard-deny is **data exfiltration across a trust boundary**: private-repo code
going out, a mid-session remote repoint, a whole tree pushed to a new
destination. **Bypass turns that off.**

Two different protections, and only one is present:

| | Protects against |
|---|---|
| runtime boundary | reaching **another client's** files |
| the classifier | **this client's** code going out |

A VM does not cover the second, because a VM has network. The product **shows
the gap** beside the mode indicator — informs, does not block. G6.11's `deny`
covers part of the same ground without depending on a classifier.
