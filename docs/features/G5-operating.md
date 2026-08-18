# G5 · Operating

## G5.1 ○ Start a session from a queue item

## G5.8 ◐ Preflight before starting a session `[meta]`

Before starting: is the runtime up, does the disk have room, is the branch
clean, are dependencies installed. Avoids the session that dies 20 minutes in
because the VM filled up — which is not hypothetical on this machine, it is
today's state.

## G5.2 ○ Integrated terminal

Escape hatch, not the star.

## G5.3 ○ External tracker (GitHub first, Jira later) `[meta]`

Issues, milestones, PRs and CI state for the project, **read only**. They are
defined by managers and leads, not by you — the product mirrors, never writes.
Opening a PR from an activity is the only write.

**Pluggable** adapter, same pattern as the harness adapter: `GithubTracker`
now, `JiraTracker` later, nothing above the layer knows which.

Calls the tracker CLI **inside the runtime**, so each client uses the
credential already configured there. Isolation for free, with no token held by
the product.

## G5.4 ○ Kanban board

Secondary to the queue; it shows what exists, not what to do now. Displays both
natures side by side: issues mirrored from the tracker (read only) and your own
activities ([G8.1](G8-activities.md)), visually distinct — who created an item
changes what you can do with it.

## G5.5 ○ Notification outside the UI

Only for "you became the bottleneck", never per item. Per-item notification is
alarm fatigue with the operating system's permission.

## G5.7 ○ File explorer `[content, but yours]`

Project tree in the shape you already know from VS Code, opening files with
syntax highlighting — **colour only, no LSP and no diagnostics** — and `.md`
toggling rendered ↔ raw. A button opens the file in the real editor: you
already have a good one, and building a worse one here is weeks spent to lose.

**Read only now, prepared to edit.** The cheap way to honour that is Monaco in
read-only mode rather than a highlighted `<pre>` — editing later becomes a flag
flip, not a rewrite of the layer. Monaco is VS Code's editor, so the
familiarity comes along.

Sits **outside the confidentiality model**: the boundary governs what the AI
reads, not what you read. What it must respect is the `PathMap`, not the export
level.

## G5.6 ○ Worktree per task, optional per project

Enabled only on projects where you run two fronts at once. The field adopted
worktrees because it has no other isolation — everything runs as you, on your
machine, in one repo. You have runtime isolation and per-project separation, so
what remains is only two sessions in the **same** repo.

⚠ **Known cost:** optional support means everything that touches files — diff,
terminal, tracker, cleanup — must work in both modes, and the less-used mode is
the one that breaks unnoticed. Worth testing both paths from the start.
