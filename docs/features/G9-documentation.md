# G9 · Documentation — the knowledge surface

Not a tab inside a project: a **surface of its own**, per project, inside a
workspace, with the markdown renderer at the centre. Everything beyond markdown
— tabs, cards, pages — comes from plugins.

It is the fourth surface, and the only one that is not a time horizon.

Because the surface lives inside a workspace, it **inherits the boundary** with
no new mechanism. A project's documentation chat runs with that project's
account and does not leak — the same rule as everything else.

## G9.1 ★ Markdown at the centre, the rest by plugin `[content]`

The view is the renderer. Tab, card, page and menu come from external plugins —
the shell knows nothing about any subject.

## G9.2 ★ Documentation lives where it makes sense `[meta]`

It can be a folder inside a code repository, **or a repository of its own**.
There is no sense in creating a code repository to hold only `.md`.

What marks something as a documentation surface is the **config file**
declaring which plugins that documentation uses — not being inside a code
repository.

## G9.3 ★ Doc agent declared by the documentation itself `[content]`

You define the specialist per subject: an ESP32 study declares an agent that
understands ESP32; a marketing one declares another. **The definition lives in
the content, not in the product** — so when the repository is shared as a
template, the specialist travels with it. A study becomes content + plugins +
the agent that understands the subject.

Runs inside the project's workspace, with its account: no new boundary.

## G9.4 ○ Chat on the documentation surface `[content]`

Conversation with the doc agent about that project — what is known, what is
missing, what changed.

## G9.5 ○ Notes outside the repository `[meta]`

Content is versioned; your notes and your progress stay outside, so the
repository can be shared without them riding along. It is what makes a study
distributable as a template, and it is the same distinction as issue (theirs)
vs activity (yours), applied again.

## G9.6 ○ Standalone, cross-platform viewer — ⏸ **deferred, not cut**

The largest scope-per-user ratio in the list: a second executable,
cross-platform build, installer and code signing, for one person who is not
you.

The **boundary constraint it imposes still applies from now on** — the
documentation surface remains forbidden from depending on the cockpit, because
that discipline is cheap now and expensive to recover later. What is deferred
is building and distributing the build.
