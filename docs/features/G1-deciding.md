# G1 · Deciding well — pre-digestion

What turns a queue item into a decision you make in 30 seconds instead of ten
minutes of re-contextualising.

## G1.1 ★ Context restoration `[content]`

"What happened here since I last looked." You come back to a project after 40
minutes elsewhere and have forgotten everything. Same problem the code-review
queue solved a decade ago with incremental diff — solved there, absent here.

## G1.2 ○ Questions rendered natively `[content]`

`AskUserQuestion` becomes clickable cards. The payload already carries each
option's `label`, `description` and `preview`, structured — it only needs
drawing. Applies to `ExitPlanMode` and permission prompts too.

## G1.3 ★ What each option costs `[content]`

Beside each alternative: how much work it redoes, what it blocks later, what
becomes hard to undo. It is what the agent knows and does not say.

## G1.4 ○ The three ways to answer `[content]`

Approve as-is · reject and re-route · **edit the proposed action before
executing**. The third is the most underused: usually the answer is neither yes
nor no, it is "yes, but change this path".

## G1.5 ★ Supervisor draft (L1) `[content]`

"I would pick 2, because X." You accept, edit or ignore. It never executes on
its own.

## G1.6 ★ Source citation `[meta]`

Any advice that used content from another workspace declares which one, at the
moment of use. It is the mechanism that makes a permissive export level honest.

## G1.7 ◐ Consistency `[content]`

"You decided something similar before, and chose this." Always within the
workspace; across workspaces only per the `export level`, and with citation.
